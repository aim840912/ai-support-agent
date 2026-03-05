import { resend, EMAIL_FROM } from "./resend";
import { resetPasswordTemplate } from "./templates/reset-password";
import { createAndStoreToken, getBaseUrl } from "./token";
import { isResendConfigured } from "@/lib/mock-mode";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generates a password-reset token (stored in VerificationToken with a
 * "reset:" prefix on the identifier), and sends a reset email via Resend.
 */
export async function sendPasswordResetEmail(
  email: string,
  userName: string
): Promise<void> {
  const identifier = `reset:${email}`;
  const token = await createAndStoreToken(identifier, RESET_TTL_MS);
  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  if (isResendConfigured()) {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your password",
      html: resetPasswordTemplate({ userName, resetUrl }),
    });
  } else {
    console.log(`[Email - dev] Password reset link for ${email}: ${resetUrl}`);
  }
}
