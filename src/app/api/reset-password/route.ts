import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createRateLimiter, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";

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

  try {
    const body = await request.json();
    const { token, email, password } = schema.parse(body);

    const identifier = `reset:${email}`;
    const record = await prisma.verificationToken.findFirst({
      where: { identifier, token },
    });

    // Unified error message for both "not found" and "expired" cases.
    // Distinguishing between them would let an attacker know whether a token
    // exists (timing/enumeration attack on reset tokens).
    const INVALID_LINK_ERROR = { error: "Invalid or expired reset link. Please request a new one." };

    if (!record) {
      return NextResponse.json(INVALID_LINK_ERROR, { status: 400 });
    }

    if (record.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      return NextResponse.json(INVALID_LINK_ERROR, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      }),
      prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      }),
    ]);

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("[reset-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
