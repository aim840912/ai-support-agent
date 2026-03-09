import type { UIMessage } from "ai";

export const MAX_MESSAGES = 50; // max history depth sent per request
export const MAX_MESSAGE_LENGTH = 4000; // max characters per individual message

export type ValidateResult =
  | { ok: true; messages: UIMessage[] }
  | { ok: false; error: string; status: number };

/**
 * Validates and sanitizes the raw messages array from a chat request body.
 *
 * Checks performed:
 *  1. Must be a non-empty array.
 *  2. Length cannot exceed MAX_MESSAGES.
 *  3. Each message's text content cannot exceed MAX_MESSAGE_LENGTH.
 *  4. Strips messages with disallowed roles (prevents role:"system" injection).
 *
 * Used by both /api/chat (dashboard) and /api/widget/chat (widget) routes.
 */
export function validateAndSanitizeMessages(rawMessages: unknown): ValidateResult {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { ok: false, error: "messages array is required", status: 400 };
  }

  const messages = rawMessages as UIMessage[];

  if (messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      error: `Too many messages (max ${MAX_MESSAGES})`,
      status: 400,
    };
  }

  // Validate each message's text content length
  for (const msg of messages) {
    const text =
      msg.parts
        ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join("") ?? "";
    if (text.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
        status: 400,
      };
    }
  }

  // Strip any messages with disallowed roles — prevents a client from injecting
  // role:"system" messages that could override or bypass the server-side system prompt.
  const ALLOWED_ROLES = new Set(["user", "assistant"]);
  const sanitized = messages.filter((msg) => ALLOWED_ROLES.has(msg.role));
  if (sanitized.length === 0) {
    return { ok: false, error: "No valid messages", status: 400 };
  }

  return { ok: true, messages: sanitized };
}
