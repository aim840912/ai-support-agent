import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createSupportAgent } from "@/lib/ai/agent";
import { createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";

export async function POST(request: Request) {
  // Auth guard
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: userId, orgId } = session.user;

  let body: { messages: UIMessage[]; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages, sessionId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages array is required", { status: 400 });
  }

  // Find or create a ChatSession in the database
  // This is fire-and-forget for the session upsert; we don't block streaming on it
  let resolvedSessionId = sessionId;

  if (!resolvedSessionId) {
    try {
      const chatSession = await prisma.chatSession.create({
        data: {
          orgId,
          userId,
          source: "dashboard",
        },
        select: { id: true },
      });
      resolvedSessionId = chatSession.id;
    } catch (e) {
      // Non-fatal: streaming will work even without a persisted session
      console.error("[chat/route] Failed to create ChatSession:", e);
    }
  }

  // Create and stream the agent response
  const agent = createSupportAgent(orgId);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    onFinish: async ({ responseMessage }) => {
      if (!resolvedSessionId) return;

      // Persist the last user message and the assistant response
      try {
        const lastUserMessage = messages[messages.length - 1];

        // Extract plain text from UIMessage parts for storage
        const userText = lastUserMessage?.parts
          ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("") ?? "";

        const assistantText = responseMessage?.parts
          ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("") ?? "";

        await prisma.chatMessage.createMany({
          data: [
            {
              sessionId: resolvedSessionId,
              role: "user",
              content: userText,
            },
            {
              sessionId: resolvedSessionId,
              role: "assistant",
              content: assistantText,
            },
          ],
        });
      } catch (e) {
        // Non-fatal: persistence failure should not affect the user
        console.error("[chat/route] Failed to persist messages:", e);
      }
    },
  });
}
