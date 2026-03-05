import { resend, EMAIL_FROM } from "./resend";
import { verifyEmailTemplate } from "./templates/verify-email";
import { createAndStoreToken, getBaseUrl } from "./token";
import { isResendConfigured } from "@/lib/mock-mode";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generates a verification token, stores it in VerificationToken table,
 * and sends a verification email via Resend.
 */
export async function sendVerificationEmail(
  email: string,
  userName: string
): Promise<void> {
  const token = await createAndStoreToken(email, VERIFICATION_TTL_MS);
  const verifyUrl = `${getBaseUrl()}/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  if (isResendConfigured()) {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email address",
      html: verifyEmailTemplate({ userName, verifyUrl }),
    });
  } else {
    console.log(`[Email - dev] Verify email link for ${email}: ${verifyUrl}`);
  }
}
