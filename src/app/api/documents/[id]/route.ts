import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";
import { isDemoUser } from "@/lib/demo";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDemoUser(session.user.email)) {
    return NextResponse.json({ error: "Demo account cannot delete data" }, { status: 403 });
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
