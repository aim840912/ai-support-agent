import { createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { safeStreamOnError } from "@/lib/api-error-handler";
import { persistTurn, type PersistedToolCall } from "./persist-turn";
import type { ChatContext } from "./prepare-chat";

type MessageLike = { parts?: UIMessage["parts"] } | undefined;
type TextPart = Extract<UIMessage["parts"][number], { type: "text" }>;

/** Concatenates every text part of a message; "" when there are none. */
export function extractText(message: MessageLike): string {
  return (
    message?.parts
      ?.filter((p): p is TextPart => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

/**
 * Tool parts carry only identity here — no input/output. That is a known
 * limitation: it makes the transcript auditable but not replayable, which is
 * why history rehydration restores text only.
 */
export function extractToolCalls(message: MessageLike): PersistedToolCall[] {
  return (
    message?.parts
      ?.filter((p) => p.type.startsWith("tool-") || p.type === "dynamic-tool")
      .map((p) => {
        const tp = p as { type: string; toolName?: string; toolCallId: string };
        return {
          toolName: tp.toolName ?? tp.type.replace(/^tool-/, ""),
          toolCallId: tp.toolCallId,
        };
      }) ?? []
  );
}

/**
 * Web driver: streams the answer as an AI SDK UI message stream (SSE) and
 * persists the turn once the stream finishes.
 *
 * Returns the SDK's promise WITHOUT awaiting it, and callers must keep it that
 * way: in an async function `return promise` leaves rejections uncaught by the
 * enclosing try/catch, whereas `return await promise` would catch them. The
 * existing routes rely on the former — stream-time failures belong to
 * safeStreamOnError, not to a 500 branch.
 */
export function streamChatResponse(ctx: ChatContext): Promise<Response> {
  return createAgentUIStreamResponse({
    agent: ctx.agent,
    uiMessages: ctx.messages,
    onError: safeStreamOnError,
    onFinish: async ({ responseMessage }) => {
      await persistTurn({
        sessionId: ctx.sessionId,
        userText: extractText(ctx.messages[ctx.messages.length - 1]),
        assistantText: extractText(responseMessage),
        toolCalls: extractToolCalls(responseMessage),
      });
    },
  });
}
