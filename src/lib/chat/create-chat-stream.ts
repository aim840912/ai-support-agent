import { prisma } from "@/lib/db";
import { createSupportAgent } from "@/lib/ai/agent";
import { createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";

type CreateChatStreamOptions = {
  orgId: string;
  messages: UIMessage[];
  sessionId?: string;
  userId?: string;
  visitorId?: string;
  source?: "dashboard" | "widget" | "api";
};

/**
 * Shared agent + message persistence logic used by both
 * /api/chat (dashboard) and /api/widget/chat (widget).
 *
 * Returns a streaming Response.
 */
export async function createChatStream({
  orgId,
  messages,
  sessionId,
  userId,
  visitorId,
  source = "dashboard",
}: CreateChatStreamOptions): Promise<Response> {
  // Find or create a ChatSession
  let resolvedSessionId = sessionId;

  if (!resolvedSessionId) {
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
      console.error("[createChatStream] Failed to create ChatSession:", e);
    }
  }

  const agent = createSupportAgent(orgId);

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

        await prisma.chatMessage.createMany({
          data: [
            { sessionId: resolvedSessionId, role: "user", content: userText },
            {
              sessionId: resolvedSessionId,
              role: "assistant",
              content: assistantText,
            },
          ],
        });
      } catch (e) {
        console.error("[createChatStream] Failed to persist messages:", e);
      }
    },
  });
}
