import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";

const ASSIGNABLE_ROLES = ["admin", "member"] as const;

const patchSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
});

/**
 * PATCH /api/team/:id — Update a member's role.
 * Only the owner can change roles.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId || !session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId, id: currentUserId } = session.user;
  const currentRole = session.user.role as string;

  if (currentRole !== "owner") {
    return Response.json({ error: "Only the owner can change roles" }, { status: 403 });
  }

  const { id: targetUserId } = await context.params;

  // Cannot modify yourself
  if (targetUserId === currentUserId) {
    return Response.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    // updateMany with orgId in the where clause eliminates the TOCTOU race
    // between the pre-check findFirst and the actual update.
    const { count } = await prisma.user.updateMany({
      where: { id: targetUserId, orgId },
      data: { role: parsed.data.role },
    });

    if (count === 0) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    return Response.json({ id: targetUserId, role: parsed.data.role });
  } catch (error) {
    logError("[TeamAPI PATCH/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/team/:id — Remove a member from the org.
 * Owner and admin can remove members.
 * Only owner can remove admins.
 * Cannot remove yourself (use account deletion instead).
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId || !session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId, id: currentUserId } = session.user;
  const currentRole = session.user.role as string;

  const { id: targetUserId } = await context.params;

  // Cannot remove yourself
  if (targetUserId === currentUserId) {
    return Response.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  try {
    const target = await prisma.user.findFirst({ where: { id: targetUserId, orgId } });
    if (!target) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    // Admins can only remove members, not other admins or owners
    if (currentRole === "admin" && ["admin", "owner"].includes(target.role)) {
      return Response.json({ error: "Insufficient permissions to remove this member" }, { status: 403 });
    }

    // Members cannot remove anyone
    if (currentRole === "member") {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Cannot remove the owner
    if (target.role === "owner") {
      return Response.json({ error: "Cannot remove the organization owner" }, { status: 400 });
    }

    // deleteMany with orgId in the where clause eliminates the TOCTOU race
    // between the pre-check findFirst and the actual delete.  The findFirst
    // above is still required here to read target.role for permission checks.
    const { count } = await prisma.user.deleteMany({ where: { id: targetUserId, orgId } });

    if (count === 0) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logError("[TeamAPI DELETE/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
