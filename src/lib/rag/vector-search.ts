import { prisma } from "@/lib/db";
import { embedTexts } from "./embedding";

export type SearchResult = {
  chunkText: string;
  similarity: number;
  filename: string;
};

/**
 * Search knowledge base using cosine similarity via pgvector.
 * Returns top-k most similar chunks for the given query.
 */
export async function vectorSearch(
  query: string,
  orgId: string,
  limit = 5
): Promise<SearchResult[]> {
  const [queryVector] = await embedTexts([query]);

  // Format vector as Postgres literal: '[0.1, 0.2, ...]'
  const vectorLiteral = `[${queryVector.join(",")}]`;

  // Raw SQL — column names need double-quotes because schema uses camelCase
  // without @@map
  const results = await prisma.$queryRawUnsafe<SearchResult[]>(
    `
    SELECT
      e."chunkText",
      1 - (e.vector <=> $1::vector) AS similarity,
      d.filename
    FROM "Embedding" e
    JOIN "Document" d ON d.id = e."documentId"
    WHERE e."orgId" = $2
      AND d.status = 'ready'
    ORDER BY e.vector <=> $1::vector
    LIMIT $3
    `,
    vectorLiteral,
    orgId,
    limit
  );

  return results;
}
