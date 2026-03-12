import { prisma } from "@/lib/db";
import { splitText } from "./text-splitter";
import { embedTexts } from "./embedding";
import { logError } from "@/lib/error-logger";

/**
 * Full RAG pipeline: extract text → split → embed → store vectors.
 *
 * Called fire-and-forget from the upload API. Updates document.status
 * to 'ready' or 'error' when done.
 */
export async function processDocument(
  documentId: string,
  buffer: Buffer,
  filename: string,
  orgId: string
): Promise<void> {
  try {
    // 1. Extract text
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    let text = "";

    if (ext === "pdf") {
      // pdf-parse is CJS-only — must use require, not import
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const parsed = await pdfParse(buffer);
      text = parsed.text as string;
    } else {
      text = buffer.toString("utf-8");
    }

    if (!text.trim()) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "error" },
      });
      return;
    }

    // 2. Split into chunks
    const chunks = splitText(text, { chunkSize: 1000, chunkOverlap: 200 });

    // 3. Generate embeddings (batched, 768-dim Gemini)
    const vectors = await embedTexts(chunks);

    // 4. Store embeddings via raw SQL (Prisma doesn't support vector type natively)
    for (let i = 0; i < chunks.length; i++) {
      const vectorLiteral = `[${vectors[i].join(",")}]`;

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "Embedding" (id, "chunkText", vector, "documentId", "orgId")
        VALUES (gen_random_uuid()::text, $1, $2::vector, $3, $4)
        `,
        chunks[i],
        vectorLiteral,
        documentId,
        orgId
      );
    }

    // 5. Mark document as ready
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "ready",
        chunkCount: chunks.length,
      },
    });
  } catch (err) {
    logError("[processDocument]", err);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "error" },
    });
    throw err;
  }
}
