import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/team/accept-invite?token=...
 *
 * Public route (no auth required).
 * Validates the invitation token and redirects the user to register
 * (pre-filling email) or, if they already have an account, redirects
 * to login with a query param to trigger org-join on next sign-in.
 *
 * The actual account creation / org-joining is handled by:
 * - POST /api/register (for new users, with inviteToken)
 * - Or by the JWT callback in auth.ts if they log in with OAuth
 */
export async function GET(request: NextRequest) {
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
      // User exists but is not in this org yet — add them
      if (existingUser.orgId !== invitation.orgId) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { orgId: invitation.orgId, role: invitation.role },
        });
      }
      // Clean up invitation
      await prisma.invitation.delete({ where: { token } });
      return NextResponse.redirect(new URL("/login?message=invite_accepted", request.url));
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
