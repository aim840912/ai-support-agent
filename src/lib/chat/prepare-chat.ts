import { prisma } from "@/lib/db";
import { createSupportAgent } from "@/lib/ai/agent";
import { classifyComplexity, type ComplexityTier } from "@/lib/ai/model-router";
import type { UIMessage } from "ai";
import { checkConversationLimit, checkMessageLimit } from "@/lib/plan/check-plan-limit";
import { logError } from "@/lib/error-logger";
import type { ValidSource } from "@/lib/constants";

export type PrepareChatOptions = {
  orgId: string;
  messages: UIMessage[];
  sessionId?: string;
  userId?: string;
  visitorId?: string;
  source?: ValidSource;
  plan?: string;
  /** Org-specific AI instructions — injected safely before security rules. */
  customSystemPrompt?: string | null;
};

/**
 * Why a chat turn cannot start. Carries a `code` rather than a Response so each
 * channel can render it in its own idiom — HTTP JSON for the web routes, a
 * human sentence for a messaging channel that has no status codes.
 */
export type PrepareChatError =
  | { code: "CONVERSATION_LIMIT"; message: string; status: 429 }
  | { code: "MESSAGE_LIMIT"; message: string; status: 429 }
  | { code: "SESSION_NOT_FOUND"; message: string; status: 404 };

export type ChatContext = {
  orgId: string;
  /**
   * Undefined when session creation failed. That is deliberate, not an
   * oversight: the conversation still runs, it just isn't persisted. Narrowing
   * this to `string` would turn a degraded path into a hard failure.
   */
  sessionId: string | undefined;
  messages: UIMessage[];
  agent: ReturnType<typeof createSupportAgent>;
  tier: ComplexityTier;
};

export type PrepareChatResult =
  | { ok: true; ctx: ChatContext }
  | { ok: false; error: PrepareChatError };

/**
 * Channel-neutral front half of a chat turn: resolve or create the session,
 * enforce plan limits, pick a model tier and build the agent.
 *
 * Shared by every channel. The back half (how the answer is delivered and
 * persisted) lives in drivers.ts.
 */
export async function prepareChat({
  orgId,
  messages,
  sessionId,
  userId,
  visitorId,
  source = "dashboard",
  plan = "free",
  customSystemPrompt,
}: PrepareChatOptions): Promise<PrepareChatResult> {
  let resolvedSessionId = sessionId;

  if (!resolvedSessionId) {
    // Check conversation limit before creating a new session.
    // Pass plan so the check can skip an extra org DB fetch.
    const convLimit = await checkConversationLimit(orgId, plan);
    if (!convLimit.allowed) {
      return {
        ok: false,
        error: { code: "CONVERSATION_LIMIT", message: convLimit.reason, status: 429 },
      };
    }

    try {
      const chatSession = await prisma.chatSession.create({
        data: {
          orgId,
          source,
          userId: userId ?? null,
          visitorId: visitorId ?? null,
        },
        select: { id: true },
      });
      resolvedSessionId = chatSession.id;
    } catch (e) {
      logError("[prepareChat] Failed to create ChatSession:", e);
    }
  } else {
    // Verify the session belongs to this org before reading/writing messages.
    // Without this check, an attacker could supply a sessionId from another
    // org's conversation and append messages to it (cross-tenant injection).
    const existingSession = await prisma.chatSession.findUnique({
      where: { id: resolvedSessionId, orgId },
      select: { id: true },
    });
    if (!existingSession) {
      return {
        ok: false,
        error: { code: "SESSION_NOT_FOUND", message: "Session not found", status: 404 },
      };
    }

    // Existing session — check message limit.
    // Pass plan so the check can skip an extra org DB fetch.
    const msgLimit = await checkMessageLimit(orgId, resolvedSessionId, plan);
    if (!msgLimit.allowed) {
      return {
        ok: false,
        error: { code: "MESSAGE_LIMIT", message: msgLimit.reason, status: 429 },
      };
    }
  }

  // Model-routing experiment: classify complexity and route the model tier.
  const decision = classifyComplexity(messages);
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[model-router] tier=${decision.tier} score=${decision.score} reasons=[${decision.reasons.join(",")}] source=${source}`
    );
  }

  const agent = createSupportAgent(orgId, plan, customSystemPrompt, decision.tier);

  return {
    ok: true,
    ctx: { orgId, sessionId: resolvedSessionId, messages, agent, tier: decision.tier },
  };
}
