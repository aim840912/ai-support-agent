import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createRateLimiter, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// 10 verification attempts per IP per 15 minutes — prevents token brute-forcing
const verifyEmailLimiter = createRateLimiter({ limit: 10, window: "15m" });

/**
 * GET /api/verify-email?token=...&email=...
 *
 * Safe prefetch/scanner guard: validates that the token exists and is not
 * expired, then redirects to the client-side confirmation page. The actual
 * mutation (marking emailVerified, deleting token) is deferred to the POST
 * handler, which is called automatically by the confirm page.
 *
 * This prevents email security scanners, browser prefetch, and link-preview
 * bots from consuming the one-time token before the user clicks.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(verifyEmailLimiter, `verify-email:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-verification-link", request.url)
    );
  }

  // Lightweight existence check — does NOT consume the token.
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: email, token },
  });

  if (!record) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-verification-link", request.url)
    );
  }

  if (record.expires < new Date()) {
    return NextResponse.redirect(
      new URL("/login?error=verification-link-expired", request.url)
    );
  }

  // Token looks valid — hand off to the confirm page which will POST to mutate.
  const confirmUrl = new URL("/verify-email/confirm", request.url);
  confirmUrl.searchParams.set("token", token);
  confirmUrl.searchParams.set("email", email);
  return NextResponse.redirect(confirmUrl);
}

/**
 * POST /api/verify-email
 * Body: { token: string; email: string }
 *
 * Performs the actual email verification in a single interactive transaction:
 * findFirst + expiry check + user update + token delete are all atomic,
 * which eliminates the TOCTOU race present in the previous GET mutation.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(verifyEmailLimiter, `verify-email:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  let token: string;
  let email: string;
  try {
    const body = await request.json();
    if (
      !body.token || typeof body.token !== "string" ||
      !body.email || typeof body.email !== "string"
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    token = body.token;
    email = body.email;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    // Atomic: find + validate + update + delete in one transaction.
    // Prevents concurrent requests from both passing the existence check.
    await prisma.$transaction(async (tx) => {
      const record = await tx.verificationToken.findFirst({
        where: { identifier: email, token },
      });

      if (!record) {
        throw new Error("INVALID_TOKEN");
      }

      if (record.expires < new Date()) {
        await tx.verificationToken.delete({
          where: { identifier_token: { identifier: email, token } },
        });
        throw new Error("EXPIRED_TOKEN");
      }

      await tx.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      });

      await tx.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_TOKEN") {
        return NextResponse.json({ error: "Invalid verification link" }, { status: 400 });
      }
      if (error.message === "EXPIRED_TOKEN") {
        return NextResponse.json({ error: "Verification link has expired" }, { status: 400 });
      }
    }
    console.error("[VerifyEmail POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
