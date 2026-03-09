import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/error-logger";

const switchSchema = z.object({
  orgId: z.string().min(1),
});

/**
 * POST /api/organizations/switch
 * Body: { orgId: string }
 *
 * Switches the authenticated user's activeOrgId to the specified org.
 * The caller MUST be a member of the target org — verified via UserOrganization.
 *
 * After a successful switch, the client should call:
 *   useSession().update({ activeOrgId }) — triggers JWT callback with
 *   trigger === "update", which immediately rotates the orgId/role in the token.
 *   Then call router.refresh() to re-render server components with the new session.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { orgId } = parsed.data;

    // Security: verify the user is actually a member of the target org.
    // Without this check, any authenticated user could switch to any org id.
    const membership = await prisma.userOrganization.findUnique({
      where: { userId_orgId: { userId: session.user.id, orgId } },
      select: { role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeOrgId: orgId },
    });

    // Return the new role so the client can call useSession().update({ activeOrgId })
    // which triggers the JWT callback with trigger === "update" for an immediate token refresh.
    return NextResponse.json({ success: true, orgId, role: membership.role });
  } catch (error) {
    logError("[Organizations Switch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
