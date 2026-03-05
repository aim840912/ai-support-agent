/**
 * Simple HTML email template for email verification.
 * Returns a plain HTML string (no React Email dependency needed).
 */
export function verifyEmailTemplate({
  userName,
  verifyUrl,
}: {
  userName: string;
  verifyUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden;">
    <tr>
      <td style="padding: 40px 40px 24px;">
        <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #18181b;">Verify your email address</h1>
        <p style="margin: 0 0 24px; font-size: 15px; color: #52525b; line-height: 1.6;">
          Hi ${userName}, welcome to AI Support Agent! Click the button below to verify your email address and activate your account.
        </p>
        <a href="${verifyUrl}"
           style="display: inline-block; padding: 12px 24px; background: #18181b; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Verify Email Address
        </a>
        <p style="margin: 24px 0 0; font-size: 13px; color: #a1a1aa;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 40px; background: #f4f4f5; border-top: 1px solid #e4e4e7;">
        <p style="margin: 0; font-size: 12px; color: #71717a;">
          If the button doesn't work, copy this URL: <br />
          <a href="${verifyUrl}" style="color: #3f3f46; word-break: break-all;">${verifyUrl}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
