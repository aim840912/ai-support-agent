import crypto from "crypto";
import { prisma } from "@/lib/db";
import { resend, EMAIL_FROM } from "./resend";
import { inviteMemberTemplate } from "./templates/invite-member";
import { getBaseUrl } from "./token";
import { isResendConfigured } from "@/lib/mock-mode";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates an invitation record and sends the invitation email.
 * Returns the raw invitation token.
 */
export async function sendInvitationEmail({
  email,
  role,
  orgId,
  orgName,
  invitedBy,
  inviterName,
}: {
  email: string;
  role: "admin" | "member";
  orgId: string;
  orgName: string;
  invitedBy: string;
  inviterName: string;
}): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + INVITATION_TTL_MS);

  // Replace any existing invitation atomically — prevents stale orphan record if
  // the process crashes between delete and create (e.g. user gets an email with a
  // token that was never persisted).
  await prisma.$transaction([
    prisma.invitation.deleteMany({ where: { email, orgId } }),
    prisma.invitation.create({ data: { email, role, token, orgId, invitedBy, expires } }),
  ]);

  const inviteUrl = `${getBaseUrl()}/api/team/accept-invite?token=${token}`;

  if (isResendConfigured()) {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `You've been invited to join ${orgName} on AI Support Agent`,
      html: inviteMemberTemplate({ inviterName, orgName, role, inviteUrl }),
    });
  } else if (process.env.NODE_ENV !== "production") {
    // Guard the entire block — even the truncated token prefix should not appear
    // in production logs where it could be treated as a leaked secret.
    const tokenPreview = `${token.slice(0, 8)}...`;
    console.log(`[Email - dev] Invitation for ${email} to org ${orgName} — token: ${tokenPreview}`);
    console.log(`[Email - dev] Full URL: ${inviteUrl}`);
  }

  return token;
}
