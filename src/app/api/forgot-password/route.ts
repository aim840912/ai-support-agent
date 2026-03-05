import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = schema.parse(body);

    // Always return 200 to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true },
    });

    if (user) {
      // Fire-and-forget: don't await so we don't leak timing info
      sendPasswordResetEmail(email, user.name ?? email.split("@")[0]).catch(
        (err) => console.error("[forgot-password] Email error:", err)
      );
    }

    return NextResponse.json({
      message: "If that email is registered, you will receive a reset link.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    console.error("[forgot-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
