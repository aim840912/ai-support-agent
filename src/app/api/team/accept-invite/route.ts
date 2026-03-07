import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// 10 invite-accept attempts per IP per 15 minutes — prevents token brute-forcing
const acceptInviteLimiter = createRateLimiter({ limit: 10, window: "15m" });

/**
 * GET /api/team/accept-invite?token=...
 *
 * Public route — validates the invitation token and redirects:
 *
 * - NEW user  → /register?inviteToken=...&email=... (pre-fill form, org-join
 *               happens inside POST /api/register)
 * - EXISTING user → /login?callbackUrl=/invite/confirm?token=... (user must
 *               authenticate first; actual orgId update runs in the
 *               authenticated POST handler below)
 *
 * Security: We intentionally DO NOT modify orgId from an unauthenticated GET —
 * doing so would allow an attacker with a stolen invite token to silently
 * reassign any matching user to a different org without their knowledge.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(acceptInviteLimiter, `accept-invite:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_invite", request.url));
  }

  try {
    const invitation = await prisma.invitation.findUnique({ where: { token } });

    if (!invitation) {
      return NextResponse.redirect(new URL("/login?error=invalid_invite", request.url));
    }

    if (invitation.expires < new Date()) {
      return NextResponse.redirect(new URL("/login?error=expired_invite", request.url));
    }

    // Check if a user with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });

    if (existingUser) {
      // Existing user must authenticate first — redirect to login, then to the
      // confirm page which performs the actual (authenticated) org-join mutation.
      const origin = new URL(request.url).origin;
      const confirmUrl = `${origin}/invite/confirm?token=${encodeURIComponent(token)}`;
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", confirmUrl);
      loginUrl.searchParams.set("message", "login_to_accept_invite");
      return NextResponse.redirect(loginUrl);
    }

    // New user — redirect to register with invite context
    const registerUrl = new URL("/register", request.url);
    registerUrl.searchParams.set("inviteToken", token);
    registerUrl.searchParams.set("email", invitation.email);
    return NextResponse.redirect(registerUrl);
  } catch (error) {
    console.error("[AcceptInvite]", error);
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}

/**
 * POST /api/team/accept-invite
 * Body: { token: string }
 *
 * Authenticated route — completes org-join for existing users.
 * Called from /invite/confirm page after the user has logged in.
 * Verifies the session email matches the invitation email before mutating.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(acceptInviteLimiter, `accept-invite:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token: string;
  try {
    const body = await request.json();
    if (!body.token || typeof body.token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    token = body.token;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const invitation = await prisma.invitation.findUnique({ where: { token } });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    if (invitation.expires < new Date()) {
      await prisma.invitation.delete({ where: { token } });
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    // Critical: ensure the authenticated user's email matches the invite recipient.
    // Prevents a logged-in user from accepting an invite meant for someone else.
    if (session.user.email !== invitation.email) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { orgId: invitation.orgId, role: invitation.role },
      }),
      prisma.invitation.delete({ where: { token } }),
    ]);

    return NextResponse.json({ message: "Invite accepted" });
  } catch (error) {
    console.error("[AcceptInvite POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
