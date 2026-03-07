/**
 * HTML email template for team member invitations.
 * Returns a plain HTML string — no React Email dependency needed.
 */
export function inviteMemberTemplate({
  inviterName,
  orgName,
  role,
  inviteUrl,
}: {
  inviterName: string;
  orgName: string;
  role: string;
  inviteUrl: string;
}): string {
  const roleLabel = role === "admin" ? "Admin" : "Member";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to ${orgName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden;">
    <tr>
      <td style="padding: 40px 40px 24px;">
        <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #18181b;">
          You've been invited to join ${orgName}
        </h1>
        <p style="margin: 0 0 24px; font-size: 15px; color: #52525b; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as a <strong>${roleLabel}</strong> on AI Support Agent.
          Click the button below to accept the invitation and set up your account.
        </p>
        <a href="${inviteUrl}"
           style="display: inline-block; padding: 12px 24px; background: #18181b; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Accept Invitation
        </a>
        <p style="margin: 24px 0 0; font-size: 13px; color: #a1a1aa;">
          This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 40px; background: #f4f4f5; border-top: 1px solid #e4e4e7;">
        <p style="margin: 0; font-size: 12px; color: #71717a;">
          If the button doesn't work, copy this URL: <br />
          <a href="${inviteUrl}" style="color: #3f3f46; word-break: break-all;">${inviteUrl}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
