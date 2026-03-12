/**
 * Shared utilities for handling external API quota / rate-limit errors.
 *
 * All three providers (Groq LLM, Google Gemini, Resend) return HTTP 429
 * when the free-tier quota is exhausted.  Without explicit handling the
 * application would propagate a raw 500 and potentially leak provider
 * error messages or API details to the client.
 *
 * Usage:
 *   import { isQuotaError, getSafeErrorMessage, safeStreamOnError } from "@/lib/api-error-handler";
 */

import { APICallError, RetryError } from "ai";

/**
 * Keyword fallback for non-AI-SDK errors (e.g. Resend HTTP client).
 * Only reached when neither APICallError nor RetryError matches.
 */
const QUOTA_KEYWORDS = [
  "429",
  "quota",
  "rate limit",
  "ratelimit",
  "rate_limit",
  "too many requests",
  "resource_exhausted",
  "billing",
  "exceeded",
  "exhausted",
] as const;

/**
 * Returns true when `error` looks like a provider quota / rate-limit error.
 *
 * Three-layer detection (most precise first):
 *  1. AI SDK APICallError  — typed statusCode check (Groq / Gemini)
 *  2. AI SDK RetryError    — unwrap lastError and recurse (retry-exhausted path)
 *  3. Keyword fallback     — message matching for non-AI-SDK clients (Resend)
 */
export function isQuotaError(error: unknown): boolean {
  if (error == null) return false;

  // Layer 1: AI SDK APICallError — precise typed statusCode check
  if (APICallError.isInstance(error)) {
    return error.statusCode === 429;
  }

  // Layer 2: AI SDK RetryError — unwrap the last attempt and recurse
  if (RetryError.isInstance(error)) {
    return isQuotaError(error.lastError);
  }

  // Layer 3: Fallback for non-AI-SDK errors (e.g. Resend HTTP client)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return QUOTA_KEYWORDS.some((kw) => msg.includes(kw));
  }

  return false;
}

/**
 * Returns a safe, user-facing error message that never exposes internal details.
 *
 * - Quota / rate-limit errors  → asks the user to retry later
 * - All other errors           → generic "something went wrong"
 */
export function getSafeErrorMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return "AI service temporarily unavailable. Please try again later.";
  }
  return "Something went wrong. Please try again.";
}

/**
 * Drop-in `onError` callback for the Vercel AI SDK stream helpers.
 *
 * The SDK calls this with the raw provider error; returning a string causes
 * that string to be sent as the final stream message instead of the raw error.
 *
 *   createAgentUIStreamResponse({ ..., onError: safeStreamOnError })
 */
export function safeStreamOnError(error: unknown): string {
  return getSafeErrorMessage(error);
}
