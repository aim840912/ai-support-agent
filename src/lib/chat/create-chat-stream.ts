import { logError } from "@/lib/error-logger";
import { isQuotaError, getSafeErrorMessage } from "@/lib/api-error-handler";
import { prepareChat, type PrepareChatOptions } from "./prepare-chat";
import { streamChatResponse } from "./drivers";

type CreateChatStreamOptions = PrepareChatOptions;

/**
 * Shared agent + message persistence logic used by both
 * /api/chat (dashboard) and /api/widget/chat (widget).
 *
 * Returns a streaming Response, or a 429 Response if plan limits are hit.
 *
 * This is the HTTP adapter over the channel-neutral pipeline: prepareChat()
 * decides whether the turn may run, streamChatResponse() delivers it. Channels
 * without HTTP semantics (Telegram) call those two directly instead.
 */
export async function createChatStream(opts: CreateChatStreamOptions): Promise<Response> {
  const prepared = await prepareChat(opts);

  if (!prepared.ok) {
    const { message, code, status } = prepared.error;
    return new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    return streamChatResponse(prepared.ctx);
  } catch (error) {
    logError("[createChatStream]", error);
    const message = getSafeErrorMessage(error);
    return Response.json({ error: message }, { status: isQuotaError(error) ? 429 : 500 });
  }
}
