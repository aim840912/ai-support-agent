import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { checkTeamMemberLimit } from "@/lib/plan/check-plan-limit";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";
import { createRateLimiter, checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// 10 invite sends per org per 15 minutes — prevents a compromised account from
// mass-sending invitations and exhausting the Resend API quota.
const teamInviteLimiter = createRateLimiter({ limit: 10, window: "15m" });

const INVITABLE_ROLES = ["admin", "member"] as const;

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(INVITABLE_ROLES),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  try {
    const [members, invitations, org] = await Promise.all([
      prisma.user.findMany({
        where: { orgId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invitation.findMany({
        where: { orgId, expires: { gte: new Date() } },
        select: { id: true, email: true, role: true, expires: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      }),
    ]);

    return Response.json({
      orgName: org?.name ?? "",
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
      })),
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expires: inv.expires.toISOString(),
        sentAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logError("[TeamAPI GET]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId || !session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId, id: inviterId } = session.user;
  const inviterRole = session.user.role as string;

  // Only owner and admin can invite
  if (!["owner", "admin"].includes(inviterRole)) {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Rate limit by orgId — prevents a compromised owner/admin account from
  // spamming invitations and exhausting Resend API quota.
  const rl = await checkRateLimit(teamInviteLimiter, `team-invite:${orgId}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, role } = parsed.data;

    // Admin cannot invite other admins — only owner can do that
    if (role === "admin" && inviterRole !== "owner") {
      return Response.json({ error: "Only the owner can invite admins" }, { status: 403 });
    }

    // Check if user already exists in this org
    const existingUser = await prisma.user.findFirst({ where: { email, orgId } });
    if (existingUser) {
      return Response.json({ error: "This user is already a team member" }, { status: 409 });
    }

    // Check team member limit (counts current members + pending invites)
    const limitResult = await checkTeamMemberLimit(orgId);
    if (!limitResult.allowed) {
      return Response.json({ error: limitResult.reason }, { status: 403 });
    }

    // Get inviter name and org name for the email
    const [inviter, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: inviterId }, select: { name: true } }),
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    ]);

    await sendInvitationEmail({
      email,
      role,
      orgId,
      orgName: org?.name ?? "your organization",
      invitedBy: inviterId,
      inviterName: inviter?.name ?? "A team member",
    });

    return Response.json({ message: "Invitation sent" }, { status: 201 });
  } catch (error) {
    logError("[TeamAPI POST]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
