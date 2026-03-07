import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { createRateLimiter, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// 3 password reset requests per IP per 15 minutes
const forgotPasswordLimiter = createRateLimiter({ limit: 3, window: "15m" });

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  // Rate limit by IP + email to prevent both IP rotation and email enumeration
  const ip = getClientIp(request);

  try {
    const body = await request.json();
    const { email } = schema.parse(body);

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
      await sendPasswordResetEmail(email, user.name ?? email.split("@")[0]).catch(
        (err) => console.error("[forgot-password] Email error:", err)
      );
    }

    return NextResponse.json({
      message: "If that email is registered, you will receive a reset link.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    console.error("[forgot-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
