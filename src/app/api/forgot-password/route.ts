import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import {
  createRateLimiter,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { logError } from "@/lib/error-logger";

// Outer: 10 reset requests per IP per 15 minutes (any email target)
const forgotPasswordIpLimiter = createRateLimiter({ limit: 10, window: "15m" });
// Inner: 3 reset requests per IP+email per 15 minutes
const forgotPasswordLimiter = createRateLimiter({ limit: 3, window: "15m" });

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Outer IP-only check: cap total reset requests per IP regardless of email target.
  // Prevents a single IP from triggering mass email sends to many different addresses.
  const ipRl = await checkRateLimit(forgotPasswordIpLimiter, `forgot-ip:${ip}`);
  if (!ipRl.success) return rateLimitResponse(ipRl.reset);

  try {
    const body = await request.json();
    const { email } = schema.parse(body);

    // Inner IP+email check: prevents repeated resets for the same address
    const rl = await checkRateLimit(forgotPasswordLimiter, `forgot:${ip}:${email}`);
    if (!rl.success) return rateLimitResponse(rl.reset);

    // Always return 200 to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true },
    });

    if (user) {
      // Await the email send — fire-and-forget is unreliable in serverless (Vercel
      // may terminate the container after the response is sent before the async
      // operation completes). Errors are caught so the 200 response is always returned.
      await sendPasswordResetEmail(email, user.name ?? email.split("@")[0]).catch((err) =>
        logError("[forgot-password] Email error:", err)
      );
    }

    return NextResponse.json({
      message: "If that email is registered, you will receive a reset link.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    logError("[forgot-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
