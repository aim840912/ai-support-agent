import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/send-verification";
import { isResendConfigured } from "@/lib/mock-mode";
import {
  createRateLimiter,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";
import { generateApiKey, hashApiKey } from "@/lib/api-key";
import { logError } from "@/lib/error-logger";

// 5 registration attempts per IP per 15 minutes
const registerLimiter = createRateLimiter({ limit: 5, window: "15m" });

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  orgName: z.string().min(1).optional(), // Not required when joining via invite
  inviteToken: z.string().optional(),
});

export async function POST(request: Request) {
  // Rate limit by client IP
  const ip = getClientIp(request);
  const rl = await checkRateLimit(registerLimiter, `register:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const { email, password, name, orgName, inviteToken } = registerSchema.parse(body);

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

    // Create user in a transaction.
    // If inviteToken is provided, join the invited org; otherwise create a new org.
    await prisma.$transaction(async (tx) => {
      let targetOrgId: string;
      let userRole: string = "owner";

      if (inviteToken) {
        // Joining via invitation — validate token and resolve org
        const invitation = await tx.invitation.findUnique({ where: { token: inviteToken } });
        if (!invitation || invitation.email !== email || invitation.expires < new Date()) {
          throw new Error("INVALID_INVITE");
        }
        targetOrgId = invitation.orgId;
        userRole = invitation.role;
        // Clean up used invitation
        await tx.invitation.delete({ where: { token: inviteToken } });
      } else {
        // Creating a new organization
        if (!orgName) throw new Error("Organization name is required");
        const rawApiKey = generateApiKey();
        const org = await tx.organization.create({
          data: { name: orgName, apiKey: rawApiKey, apiKeyHash: hashApiKey(rawApiKey) },
        });
        targetOrgId = org.id;
      }

      return tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          orgId: targetOrgId,
          role: userRole,
          // emailVerified is intentionally null until they click the link
        },
      });
    });

    // Await the email send — fire-and-forget is unreliable in serverless (Vercel
    // may terminate the container after the response is sent before the async
    // operation completes). Errors are caught so registration always returns 201.
    // In dev (no RESEND_API_KEY), sendVerificationEmail logs the link to console.
    await sendVerificationEmail(email, name).catch((err) =>
      logError("[register] Failed to send verification email:", err)
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
    if (error instanceof Error && error.message === "INVALID_INVITE") {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 400 });
    }
    logError("[Register]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
