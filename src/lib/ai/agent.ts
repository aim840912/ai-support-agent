import { ToolLoopAgent, stepCountIs, simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isLlmMockMode } from "@/lib/mock-mode";
import { resolveModelChoice, type ComplexityTier } from "./model-router";
import {
  createGetOrderStatusTool,
  createCheckInventoryTool,
  createCreateTicketTool,
  createSearchKnowledgeBaseTool,
} from "./tools";
import { buildSystemPrompt } from "./prompts";
import { getPlanLimits } from "@/lib/plan/limits";

/**
 * Returns the language model for the given complexity tier.
 *
 * THIS IS THE ONLY PLACE THAT NEEDS TO CHANGE when swapping providers/models.
 *
 * COST GUARD (current state): Claude auto-routing is disabled until the
 * user-pays feature ships. resolveModelChoice() (model-router.ts) maps every
 * tier to the cheap model with no fallback — no request can spend Claude
 * credits. classifyComplexity() still runs upstream and the tier is logged
 * in onStepFinish, so re-enabling later is a one-function change in
 * resolveModelChoice().
 *
 * Mock mode (no valid OPENROUTER_API_KEY) ignores the tier entirely.
 */
function getModel(tier: ComplexityTier = "simple") {
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
          ...demoText
            .split(" ")
            .flatMap((word, i) => [
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

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

  const choice = resolveModelChoice(tier);
  return choice.fallbacks.length > 0
    ? openrouter.chat(choice.primary, { models: choice.fallbacks })
    : openrouter.chat(choice.primary);
}

/**
 * Creates a configured ToolLoopAgent for customer support.
 *
 * @param orgId             - Organization ID for knowledge base and data scoping
 * @param plan              - Organization plan ("free" | "pro") for tool gating
 * @param customSystemPrompt - Optional org-specific instructions injected
 *                             between base behaviour and security rules.
 *                             Security rules always come last and cannot be
 *                             overridden — see buildSystemPrompt() in prompts.ts.
 * @param modelTier          - Complexity tier from classifyComplexity();
 *                             routes "simple" → GLM, "complex" → Claude.
 */
// Return type intentionally inferred — ToolLoopAgent<never, {tools}, never> is caller-dependent
export function createSupportAgent(
  orgId: string,
  plan = "free",
  customSystemPrompt?: string | null,
  modelTier: ComplexityTier = "simple"
) {
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
    model: getModel(modelTier),
    instructions: buildSystemPrompt(customSystemPrompt),
    tools,
    stopWhen: stepCountIs(10),
    // Support replies are short; also caps OpenRouter's per-request credit
    // pre-hold (without this, it pre-holds the model's max output — 64K tokens —
    // and small-credit accounts get a 402 before any token is generated).
    maxOutputTokens: 1024,
    // Dev-only observability: log which model actually served each step
    // (confirms whether the OpenRouter server-side fallback kicked in).
    onStepFinish: (step) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[model-router] tier=${modelTier} served-by=${step.response?.modelId}`);
      }
    },
  });
}
