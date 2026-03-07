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
    // Truncate token in log — avoid full token appearing in log aggregation
    // systems where it could be treated as a secret. Token prefix is enough
    // for local debugging (copy-paste the full URL from the console isn't needed).
    const tokenPreview = `${token.slice(0, 8)}...`;
    console.log(`[Email - dev] Verify email for ${email} — token: ${tokenPreview}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Email - dev] Full URL: ${verifyUrl}`);
    }
  }
}
