import crypto from "crypto";
import { prisma } from "@/lib/db";
import { resend, EMAIL_FROM } from "./resend";
import { resetPasswordTemplate } from "./templates/reset-password";

/**
 * Generates a password-reset token (stored in VerificationToken with a
 * "reset:" prefix on the identifier), and sends a reset email via Resend.
 */
export async function sendPasswordResetEmail(
  email: string,
  userName: string
): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const identifier = `reset:${email}`;

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith("re_placeholder")) {
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
