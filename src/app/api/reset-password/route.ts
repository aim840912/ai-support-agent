import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createRateLimiter,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";
import { logError } from "@/lib/error-logger";

// 5 reset attempts per IP per 15 minutes
const resetPasswordLimiter = createRateLimiter({ limit: 5, window: "15m" });

const schema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
});

export async function POST(request: Request) {
  // Rate limit by IP to prevent brute-forcing reset tokens
  const ip = getClientIp(request);
  const rl = await checkRateLimit(resetPasswordLimiter, `reset:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  // Parse and validate input first — ZodError is handled here, not mixed into
  // the transaction catch block below.
  let token: string;
  let email: string;
  let password: string;
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    token = parsed.token;
    email = parsed.email;
    password = parsed.password;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return a generic message — exposing error.issues leaks Zod schema structure
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Unified error message for both "not found" and "expired" cases.
  // Distinguishing between them would let an attacker know whether a token
  // exists (timing/enumeration attack on reset tokens).
  const INVALID_LINK_ERROR = { error: "Invalid or expired reset link. Please request a new one." };

  const identifier = `reset:${email}`;

  // Hash password before entering the transaction — bcrypt is CPU-intensive (~200 ms)
  // and should not hold an open DB connection during computation.
  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    // Interactive transaction: findFirst + expiry check + user update + token delete
    // are all atomic — eliminates the TOCTOU race in the previous
    // findFirst-outside + batch-$transaction pattern.
    await prisma.$transaction(async (tx) => {
      const record = await tx.verificationToken.findFirst({
        where: { identifier, token },
      });

      if (!record) throw new Error("INVALID_TOKEN");

      if (record.expires < new Date()) {
        // Do NOT delete inside the transaction — the throw causes Prisma to
        // rollback the entire transaction, undoing the delete. Cleanup is done
        // in the catch block, outside the transaction.
        throw new Error("EXPIRED_TOKEN");
      }

      await tx.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          emailVerified: new Date(), // Clicking reset link proves email ownership
          passwordChangedAt: new Date(), // Invalidates any JWT tokens issued before this moment
        },
      });

      await tx.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
    });

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_TOKEN" || error.message === "EXPIRED_TOKEN") {
        if (error.message === "EXPIRED_TOKEN") {
          // Transaction was rolled back — delete expired token outside the transaction
          // so it doesn't linger in the DB and confuse future reset attempts.
          await prisma.verificationToken
            .delete({ where: { identifier_token: { identifier, token } } })
            .catch(() => {}); // Ignore: may have been deleted by a concurrent request
        }
        return NextResponse.json(INVALID_LINK_ERROR, { status: 400 });
      }
    }
    logError("[reset-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
