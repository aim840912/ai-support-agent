import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { processDocument } from "@/lib/rag/process-document";
import { checkDocumentLimit } from "@/lib/plan/check-plan-limit";
import { createRateLimiter, checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/error-logger";

// 10 document uploads per org per hour
const documentsLimiter = createRateLimiter({ limit: 10, window: "1h" });

const ALLOWED_TYPES = ["application/pdf", "text/plain", "text/markdown"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Verify file content matches its declared MIME type using magic bytes.
 *
 * Why: `file.type` comes from the multipart Content-Type header, which the
 * client controls. An attacker can set `Content-Type: application/pdf` while
 * uploading arbitrary content (HTML, XML, scripts) to poison the knowledge base.
 *
 * We avoid adding a full `file-type` dependency and instead check the signatures
 * that matter for our allowed types:
 *   - PDF  → first 4 bytes are "%PDF"
 *   - TXT/MD → no null bytes in first 512 bytes (binary content indicator)
 */
function verifyMagicBytes(buffer: Buffer, declaredType: string): boolean {
  if (declaredType === "application/pdf") {
    return buffer.length >= 4 && buffer.slice(0, 4).toString("ascii") === "%PDF";
  }
  if (declaredType === "text/plain" || declaredType === "text/markdown") {
    // Binary files contain null bytes; text files do not.
    return !buffer.subarray(0, 512).includes(0x00);
  }
  return false;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
  } catch (error) {
    logError("[DocumentsGetAPI]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit by orgId — prevents flooding document processing pipeline
  const rl = await checkRateLimit(documentsLimiter, `documents:${session.user.orgId}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

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

  // Check document limit before processing
  const limitCheck = await checkDocumentLimit(session.user.orgId);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: limitCheck.reason, code: "DOCUMENT_LIMIT" },
      { status: 429 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Verify actual file content matches declared MIME type.
  // This catches files whose Content-Type was spoofed by the client.
  if (!verifyMagicBytes(buffer, file.type)) {
    return NextResponse.json(
      { error: "File content does not match its declared type" },
      { status: 400 }
    );
  }

  // Sanitize filename: strip directory traversal and cap length.
  // file.name comes from the client-controlled multipart header and could
  // contain path separators ("../../../etc/passwd") or excessively long strings
  // that waste DB index space.
  const sanitizedFilename = path.basename(file.name).slice(0, 255);

  // Create document record first (status: processing)
  let document;
  try {
    document = await prisma.document.create({
      data: {
        filename: sanitizedFilename,
        status: "processing",
        orgId: session.user.orgId,
      },
    });
  } catch (error) {
    logError("[DocumentsPostAPI]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Fire-and-forget: process in background (no await)
  processDocument(document.id, buffer, sanitizedFilename, session.user.orgId).catch(
    (err) => logError("[processDocument]", err)
  );

  return NextResponse.json(document, { status: 201 });
}

