/**
 * Centralized error logging helper.
 *
 * Logs only the error message — never the full Error object — to prevent
 * stack traces, file paths, and implementation details from leaking into
 * server logs (which may be forwarded to third-party observability platforms).
 *
 * Usage:
 *   import { logError } from "@/lib/error-logger";
 *   logError("[MyAPI]", error);
 */
export function logError(tag: string, error: unknown): void {
  console.error(tag, error instanceof Error ? error.message : "Unknown error");
}
