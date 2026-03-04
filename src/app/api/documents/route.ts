import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { processDocument } from "@/lib/rag/process-document";

const ALLOWED_TYPES = ["application/pdf", "text/plain", "text/markdown"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: { orgId: session.user.orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      status: true,
      chunkCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, TXT, and Markdown files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 10MB limit" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Create document record first (status: processing)
  const document = await prisma.document.create({
    data: {
      filename: file.name,
      status: "processing",
      orgId: session.user.orgId,
    },
  });

  // Fire-and-forget: process in background (no await)
  processDocument(document.id, buffer, file.name, session.user.orgId).catch(
    (err) => console.error("[processDocument]", err)
  );

  return NextResponse.json(document, { status: 201 });
}

