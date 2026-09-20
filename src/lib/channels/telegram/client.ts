import { logError } from "@/lib/error-logger";
import type { TelegramResponse, TelegramUser } from "./types";

const API_BASE = "https://api.telegram.org";

/**
 * Telegram's hard limit is 4096 characters. Chunking below it leaves room for
 * the ellipsis-free split to land on a word boundary without recounting.
 */
export const TELEGRAM_MESSAGE_LIMIT = 4000;

const REQUEST_TIMEOUT_MS = 10_000;

export type TelegramParseMode = "HTML" | "MarkdownV2";

/**
 * Calls one Bot API method.
 *
 * Checks the `ok` envelope rather than the HTTP status: Telegram answers a
 * malformed request with HTTP 400 *and* `{ ok: false }`, and some failures
 * arrive as HTTP 200 with `ok: false`.
 */
async function callApi<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): Promise<TelegramResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return (await res.json()) as TelegramResponse<T>;
  } catch (error) {
    // Network failure or timeout — normalised into the same envelope so callers
    // have one shape to handle.
    logError(`[telegram/${method}]`, error);
    return { ok: false, description: "Request to Telegram failed" };
  }
}

/**
 * Splits a reply into deliverable chunks, preferring paragraph then line
 * breaks so a split never lands mid-sentence when it can be avoided.
 */
export function chunkForTelegram(text: string, max: number = TELEGRAM_MESSAGE_LIMIT): string[] {
  if (text.length <= max) return text.length > 0 ? [text] : [];

  const chunks: string[] = [];
  let rest = text;

  while (rest.length > max) {
    const window = rest.slice(0, max);

    // Prefer a paragraph break, then any line break, then a space. lastIndexOf
    // on the window means we always take the latest break that still fits.
    let cut = window.lastIndexOf("\n\n");
    if (cut < max * 0.5) cut = window.lastIndexOf("\n");
    if (cut < max * 0.5) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max; // no break available — hard split

    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }

  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

/**
 * Sends a reply, splitting it if needed.
 *
 * When a formatted send is rejected, resends as plain text. Telegram refuses
 * the *entire* message on an entity-parsing error, so without this fallback a
 * single stray character in the model's output means the user receives nothing
 * at all — the worst possible failure for a support bot.
 */
export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  parseMode?: TelegramParseMode
): Promise<boolean> {
  const chunks = chunkForTelegram(text);
  let allSent = true;

  for (const chunk of chunks) {
    const first = await callApi(botToken, "sendMessage", {
      chat_id: chatId,
      text: chunk,
      ...(parseMode ? { parse_mode: parseMode } : {}),
    });
    if (first.ok) continue;

    if (parseMode) {
      const retry = await callApi(botToken, "sendMessage", { chat_id: chatId, text: chunk });
      if (retry.ok) continue;
    }

    logError("[telegram/sendMessage]", new Error(first.description ?? "unknown error"));
    allSent = false;
  }

  return allSent;
}

/**
 * Shows the "typing…" indicator. A tool-calling turn takes 5-15 seconds, and
 * without this the bot looks broken for the whole of it.
 *
 * Fire-and-forget: a failed indicator must never block the actual reply.
 */
export async function sendChatAction(
  botToken: string,
  chatId: number,
  action: "typing" = "typing"
): Promise<void> {
  await callApi(botToken, "sendChatAction", { chat_id: chatId, action });
}

/** Validates a bot token and returns the bot's identity, for the settings UI. */
export async function getMe(
  botToken: string
): Promise<{ ok: boolean; username?: string; description?: string }> {
  const res = await callApi<TelegramUser>(botToken, "getMe", {});
  return { ok: res.ok, username: res.result?.username, description: res.description };
}

export async function setWebhook(
  botToken: string,
  url: string,
  secretToken: string
): Promise<{ ok: boolean; description?: string }> {
  const res = await callApi<boolean>(botToken, "setWebhook", {
    url,
    secret_token: secretToken,
    // Only message updates are handled; anything else is wasted invocations.
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  return { ok: res.ok, description: res.description };
}

export async function deleteWebhook(botToken: string): Promise<{ ok: boolean }> {
  const res = await callApi<boolean>(botToken, "deleteWebhook", { drop_pending_updates: true });
  return { ok: res.ok };
}
