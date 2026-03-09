import { tool } from "ai";
import { z } from "zod";
import { isMockMode } from "@/lib/mock-mode";
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

/**
 * Factory function that creates a searchKnowledgeBase tool bound to a specific org.
 * In mock mode, returns pre-defined FAQ results. In production, calls pgvector.
 */
export function createSearchKnowledgeBaseTool(orgId: string) {
  return tool({
    description:
      "Search the company knowledge base and FAQ documents for relevant information to answer customer questions. Use this as the first step before looking up order or inventory data.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The search query derived from the customer's question. Be specific and use keywords."
        ),
      limit: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe("Number of results to return (1-5, default: 3)"),
    }),
    execute: async ({ query, limit = 3 }) => {
      if (isMockMode()) {
        // Return mock results in demo mode (no Gemini key needed)
        const results = MOCK_FAQ_RESULTS.slice(0, limit).map((r) => ({
          content: r.chunkText,
          source: r.filename,
          relevanceScore: r.similarity,
        }));
        return { results, totalFound: results.length };
      }

      // Real mode: dynamic import to avoid loading pg in edge/tests
      const { vectorSearch } = await import("@/lib/rag/vector-search");
      const rawResults = await vectorSearch(query, orgId, limit);
      const results = rawResults.map((r) => ({
        content: r.chunkText,
        source: r.filename,
        relevanceScore: r.similarity,
      }));
      return { results, totalFound: results.length };
    },
  });
}
