import { resend, EMAIL_FROM } from "./resend";
import { verifyEmailTemplate } from "./templates/verify-email";
import { createAndStoreToken, getBaseUrl } from "./token";
import { isResendConfigured } from "@/lib/mock-mode";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generates a verification token, stores it in VerificationToken table,
 * and sends a verification email via Resend.
 */
export async function sendVerificationEmail(email: string, userName: string): Promise<void> {
  const token = await createAndStoreToken(email, VERIFICATION_TTL_MS);
  const verifyUrl = `${getBaseUrl()}/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  if (isResendConfigured()) {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email address",
      html: verifyEmailTemplate({ userName, verifyUrl }),
    });
  } else if (process.env.NODE_ENV !== "production") {
    // Guard the entire block — even the truncated token prefix should not appear
    // in production logs (e.g. Docker/custom runtimes where NODE_ENV may differ
    // from "production" only unexpectedly, but we keep the guard consistent).
    const tokenPreview = `${token.slice(0, 8)}...`;
    console.log(`[Email - dev] Verify email for ${email} — token: ${tokenPreview}`);
    console.log(`[Email - dev] Full URL: ${verifyUrl}`);
  }
}
