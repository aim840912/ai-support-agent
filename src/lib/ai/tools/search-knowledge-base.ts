import { tool } from "ai";
import { z } from "zod";
import { isMockMode } from "@/lib/mock-mode";
import { logError } from "@/lib/error-logger";
import type { SearchResult } from "@/lib/rag/vector-search";

// Mock FAQ results for demo mode
const MOCK_FAQ_RESULTS: SearchResult[] = [
  {
    chunkText:
      "Our return policy allows returns within 30 days of purchase. Items must be in original condition and packaging. Refunds are processed within 5-7 business days.",
    similarity: 0.91,
    filename: "return-policy.pdf",
  },
  {
    chunkText:
      "Free shipping is available on orders over $50. Standard shipping takes 3-5 business days. Express shipping (1-2 days) is available for an additional $15.",
    similarity: 0.87,
    filename: "shipping-guide.pdf",
  },
  {
    chunkText:
      "To reset your password, click 'Forgot Password' on the login page. You will receive an email within 2 minutes. The reset link expires in 24 hours.",
    similarity: 0.82,
    filename: "account-faq.pdf",
  },
];

export const searchKnowledgeBaseDescription =
  "Search the company knowledge base and FAQ documents for relevant information to answer customer questions. Use this as the first step before looking up order or inventory data. 搜尋公司知識庫和常見問題文件，用於回答客戶的一般性問題。";

export const searchKnowledgeBaseInputSchema = z.object({
  query: z
    .string()
    .describe(
      "The search query derived from the customer's question. Use the SAME language as the customer — if the customer writes in Chinese, the query must be in Chinese. 使用與客戶相同的語言提取搜尋關鍵詞，客戶用中文則用中文搜尋。"
    ),
  limit: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .describe("Number of results to return (1-5, default: 3)"),
});

export type SearchKnowledgeBaseInput = z.infer<typeof searchKnowledgeBaseInputSchema>;

/**
 * Plain runner shared by the chat agent and the MCP server.
 *
 * The mock-mode branch and the dynamic import stay here rather than moving up
 * to the caller, so MCP inherits demo mode for free — the server is usable
 * without an embeddings key, which matters for a portfolio deployment.
 */
export async function runSearchKnowledgeBase(
  orgId: string,
  { query, limit = 3 }: SearchKnowledgeBaseInput
) {
  if (isMockMode()) {
    const results = MOCK_FAQ_RESULTS.slice(0, limit).map((r) => ({
      content: r.chunkText,
      source: r.filename,
      relevanceScore: r.similarity,
    }));
    return { results, totalFound: results.length };
  }

  // Real mode: dynamic import to avoid loading pg in edge/tests
  try {
    const { vectorSearch } = await import("@/lib/rag/vector-search");
    const rawResults = await vectorSearch(query, orgId, limit);
    const results = rawResults.map((r) => ({
      content: r.chunkText,
      source: r.filename,
      relevanceScore: r.similarity,
    }));
    return { results, totalFound: results.length };
  } catch (error) {
    logError("[searchKnowledgeBase]", error);
    return {
      results: [],
      totalFound: 0,
      error: "Knowledge base search is temporarily unavailable.",
    };
  }
}

/**
 * Factory function that creates a searchKnowledgeBase tool bound to a specific org.
 * In mock mode, returns pre-defined FAQ results. In production, calls pgvector.
 */
export function createSearchKnowledgeBaseTool(orgId: string) {
  return tool({
    description: searchKnowledgeBaseDescription,
    inputSchema: searchKnowledgeBaseInputSchema,
    execute: (input) => runSearchKnowledgeBase(orgId, input),
  });
}
