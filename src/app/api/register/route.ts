import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

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
        },
      });
    });

    return NextResponse.json(
      { message: "Account created", userId: user.id },
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
