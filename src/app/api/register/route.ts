import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/send-verification";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  orgName: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, orgName } = registerSchema.parse(body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create org then user in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName },
      });

      return tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          orgId: org.id,
          role: "owner",
          // emailVerified is intentionally null until they click the link
        },
      });
    });

    // Send verification email (fire-and-forget — don't block registration response)
    const emailSent = !!(process.env.RESEND_API_KEY || true); // always show "check email" UI
    sendVerificationEmail(email, name).catch((err) =>
      console.error("[register] Failed to send verification email:", err)
    );

    return NextResponse.json(
      { message: "Account created", userId: user.id, emailSent },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("[Register]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
