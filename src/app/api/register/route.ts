import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/send-verification";
import { isResendConfigured } from "@/lib/mock-mode";
import { createRateLimiter, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

// 5 registration attempts per IP per 15 minutes
const registerLimiter = createRateLimiter({ limit: 5, window: "15m" });

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  orgName: z.string().min(1),
});

export async function POST(request: Request) {
  // Rate limit by client IP
  const ip = getClientIp(request);
  const rl = await checkRateLimit(registerLimiter, `register:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const { email, password, name, orgName } = registerSchema.parse(body);

    // Anti-enumeration: always perform bcrypt work and return the same 201 response
    // regardless of whether the email already exists. This eliminates:
    //   1. Status code difference (409 vs 201) that reveals email existence
    //   2. Timing difference (bcrypt is slow; skipping it on duplicates was detectable)
    const existing = await prisma.user.findUnique({ where: { email } });
    const hashedPassword = await bcrypt.hash(password, 12); // always run, even for duplicates

    if (existing) {
      // Do NOT send another verification email. Return identical response to new registration.
      return NextResponse.json(
        { message: "Account created. Please check your inbox for a verification link." },
        { status: 201 }
      );
    }

    // Create org then user in a transaction (return value unused — userId intentionally
    // excluded from response to prevent internal ID leakage)
    await prisma.$transaction(async (tx) => {
      const rawApiKey = generateApiKey();
      const org = await tx.organization.create({
        data: { name: orgName, apiKey: rawApiKey, apiKeyHash: hashApiKey(rawApiKey) },
      });

      return tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          orgId: org.id,
          role: "owner",
          // emailVerified is intentionally null until they click the link
        },
      });
    });

    // Send verification email (fire-and-forget — don't block registration response).
    // In dev (no RESEND_API_KEY), sendVerificationEmail logs the link to console.
    // We always show the "check email" UI so the flow is consistent across environments.
    sendVerificationEmail(email, name).catch((err) =>
      console.error("[register] Failed to send verification email:", err)
    );
    if (!isResendConfigured()) {
      console.info("[register] Dev mode: verification link logged above (no email sent)");
    }

    // Same body as the duplicate-email path — attacker cannot distinguish
    // new registration from an existing account by comparing response fields.
    return NextResponse.json(
      { message: "Account created. Please check your inbox for a verification link." },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return a generic message — exposing error.issues leaks Zod schema structure
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("[Register]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
