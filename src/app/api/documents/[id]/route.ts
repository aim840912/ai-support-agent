import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Atomic deleteMany with orgId — eliminates the TOCTOU race that existed
    // when findFirst (with orgId) was followed by delete (with id only).
    const result = await prisma.document.deleteMany({
      where: { id, orgId: session.user.orgId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logError("[DocumentDeleteAPI]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
