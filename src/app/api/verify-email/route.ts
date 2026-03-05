import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/verify-email?token=...&email=...
 * Marks user's emailVerified if the token is valid and not expired.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-verification-link", request.url)
    );
  }

  const record = await prisma.verificationToken.findFirst({
    where: { identifier: email, token },
  });

  if (!record) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-verification-link", request.url)
    );
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    });
    return NextResponse.redirect(
      new URL("/login?error=verification-link-expired", request.url)
    );
  }

  // Mark email as verified and clean up token
  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    }),
  ]);

  return NextResponse.redirect(
    new URL("/login?verified=1", request.url)
  );
}
