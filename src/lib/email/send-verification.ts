import crypto from "crypto";
import { prisma } from "@/lib/db";
import { resend, EMAIL_FROM } from "./resend";
import { verifyEmailTemplate } from "./templates/verify-email";

/**
 * Generates a verification token, stores it in VerificationToken table,
 * and sends a verification email via Resend.
 */
export async function sendVerificationEmail(
  email: string,
  userName: string
): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Upsert: one token per email at a time
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith("re_placeholder")) {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email address",
      html: verifyEmailTemplate({ userName, verifyUrl }),
    });
  } else {
    // Dev mode: log the link instead of sending
    console.log(`[Email - dev] Verify email link for ${email}: ${verifyUrl}`);
  }
}
