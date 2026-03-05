import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("[Email] RESEND_API_KEY not set — emails will not be sent.");
}

export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "AI Support Agent <noreply@yourdomain.com>";
