import { prisma } from "@/lib/db";
import { createSupportAgent } from "@/lib/ai/agent";
import { createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { checkConversationLimit, checkMessageLimit } from "@/lib/plan/check-plan-limit";
import { logError } from "@/lib/error-logger";

type CreateChatStreamOptions = {
  orgId: string;
  messages: UIMessage[];
  sessionId?: string;
  userId?: string;
  visitorId?: string;
  source?: "dashboard" | "widget" | "api";
  plan?: string;
  /** Org-specific AI instructions — injected safely before security rules. */
  customSystemPrompt?: string | null;
};

/**
 * Shared agent + message persistence logic used by both
 * /api/chat (dashboard) and /api/widget/chat (widget).
 *
 * Returns a streaming Response, or a 429 Response if plan limits are hit.
 */
export async function createChatStream({
  orgId,
  messages,
  sessionId,
  userId,
  visitorId,
  source = "dashboard",
  plan = "free",
  customSystemPrompt,
}: CreateChatStreamOptions): Promise<Response> {
  // Find or create a ChatSession
  let resolvedSessionId = sessionId;

  if (!resolvedSessionId) {
    // Check conversation limit before creating a new session.
    // Pass plan so the check can skip an extra org DB fetch.
    const convLimit = await checkConversationLimit(orgId, plan);
    if (!convLimit.allowed) {
      return new Response(
        JSON.stringify({ error: convLimit.reason, code: "CONVERSATION_LIMIT" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
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
      logError("[createChatStream] Failed to create ChatSession:", e);
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
      return new Response(
        JSON.stringify({ error: "Session not found", code: "SESSION_NOT_FOUND" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Existing session — check message limit.
    // Pass plan so the check can skip an extra org DB fetch.
    const msgLimit = await checkMessageLimit(orgId, resolvedSessionId, plan);
    if (!msgLimit.allowed) {
      return new Response(
        JSON.stringify({ error: msgLimit.reason, code: "MESSAGE_LIMIT" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const agent = createSupportAgent(orgId, plan, customSystemPrompt);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    onFinish: async ({ responseMessage }) => {
      if (!resolvedSessionId) return;

      try {
        const lastUserMessage = messages[messages.length - 1];

        const userText =
          lastUserMessage?.parts
            ?.filter(
              (p): p is Extract<typeof p, { type: "text" }> => p.type === "text"
            )
            .map((p) => p.text)
            .join("") ?? "";

        const assistantText =
          responseMessage?.parts
            ?.filter(
              (p): p is Extract<typeof p, { type: "text" }> => p.type === "text"
            )
            .map((p) => p.text)
            .join("") ?? "";

        const toolCalls =
          responseMessage?.parts
            ?.filter((p) => p.type.startsWith("tool-") || p.type === "dynamic-tool")
            .map((p) => {
              const tp = p as {
                type: string;
                toolName?: string;
                toolCallId: string;
              };
              return {
                toolName: tp.toolName ?? tp.type.replace(/^tool-/, ""),
                toolCallId: tp.toolCallId,
              };
            }) ?? [];

        await prisma.chatMessage.createMany({
          data: [
            { sessionId: resolvedSessionId, role: "user", content: userText },
            {
              sessionId: resolvedSessionId,
              role: "assistant",
              content: assistantText,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            },
          ],
        });
      } catch (e) {
        logError("[createChatStream] Failed to persist messages:", e);
      }
    },
  });
}
