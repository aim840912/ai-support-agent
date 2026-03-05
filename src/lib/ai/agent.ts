import { ToolLoopAgent, stepCountIs, simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { createGroq } from "@ai-sdk/groq";
import { isLlmMockMode } from "@/lib/mock-mode";
import {
  createGetOrderStatusTool,
  createCheckInventoryTool,
  createCreateTicketTool,
  createSearchKnowledgeBaseTool,
} from "./tools";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts";
import { getPlanLimits } from "@/lib/plan/limits";

/**
 * Returns the language model to use.
 *
 * THIS IS THE ONLY PLACE THAT NEEDS TO CHANGE when adding a real API key.
 *
 * To switch to production:
 * 1. pnpm add @ai-sdk/groq
 * 2. Replace the mock branch with:
 *    import { createGroq } from '@ai-sdk/groq'
 *    return createGroq()('llama-3.1-70b-versatile')
 * 3. Set GROQ_API_KEY in .env.local
 */
function getModel() {
  if (isLlmMockMode()) {
    const demoText =
      "[Demo Mode] I'm a mock AI agent. In production, I would call a real LLM to answer your question. For now, I can demonstrate the tool-calling pipeline — try asking about order ORD-001 or product PROD-003!";

    // LanguageModelV3Usage requires nested structure per provider v3 spec
    const mockUsage = {
      inputTokens: { total: 50, noCache: 50, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 40, text: 40, reasoning: undefined },
    };

    const mockStreamResult = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stream: simulateReadableStream<any>({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          ...demoText.split(" ").flatMap((word, i) => [
            { type: "text-delta", id: "t1", delta: (i === 0 ? "" : " ") + word },
          ]),
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: "stop", usage: mockUsage },
        ],
        chunkDelayInMs: 30,
      }),
      request: {},
      warnings: [] as never[],
    };

    return new MockLanguageModelV3({
      provider: "mock",
      modelId: "mock-support-agent",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doStream: async (_options: any) => mockStreamResult as any,
    });
  }

  return createGroq()("llama-3.3-70b-versatile");
}

/**
 * Creates a configured ToolLoopAgent for customer support.
 *
 * @param orgId - Organization ID for knowledge base and data scoping
 * @param plan  - Organization plan ("free" | "pro") for tool gating
 */
// Return type intentionally inferred — ToolLoopAgent<never, {tools}, never> is caller-dependent
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createSupportAgent(orgId: string, plan = "free") {
  const limits = getPlanLimits(plan);
  const allowed = new Set(limits.enabledTools);

  // All possible tools — only include those allowed by the plan
  const allTools = {
    searchKnowledgeBase: createSearchKnowledgeBaseTool(orgId),
    getOrderStatus: createGetOrderStatusTool(orgId),
    checkInventory: createCheckInventoryTool(orgId),
    createTicket: createCreateTicketTool(orgId),
  };

  const tools = Object.fromEntries(
    Object.entries(allTools).filter(([key]) => allowed.has(key))
  ) as typeof allTools;

  return new ToolLoopAgent({
    model: getModel(),
    instructions: DEFAULT_SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(10),
  });
}
