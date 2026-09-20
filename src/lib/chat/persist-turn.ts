import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";

export type PersistedToolCall = { toolName: string; toolCallId: string };

export type PersistTurnInput = {
  /** Undefined when session creation failed upstream — the turn simply isn't stored. */
  sessionId: string | undefined;
  userText: string;
  assistantText: string;
  toolCalls?: PersistedToolCall[];
};

/**
 * Writes one user/assistant exchange to the transcript.
 *
 * Deliberately never throws: persistence is secondary to answering. A failed
 * write is logged and swallowed so the caller still delivers the reply.
 *
 * Takes plain values rather than UIMessage/ModelMessage so streaming and
 * non-streaming channels can share it — each extracts text in its own way.
 */
export async function persistTurn({
  sessionId,
  userText,
  assistantText,
  toolCalls,
}: PersistTurnInput): Promise<void> {
  if (!sessionId) return;

  try {
    await prisma.chatMessage.createMany({
      data: [
        { sessionId, role: "user", content: userText },
        {
          sessionId,
          role: "assistant",
          content: assistantText,
          toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        },
      ],
    });
  } catch (e) {
    logError("[persistTurn] Failed to persist messages:", e);
  }
}
