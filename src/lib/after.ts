import { after as nextAfter } from "next/server";
import { logError } from "@/lib/error-logger";

/**
 * Runs work once the response has been sent, keeping the function alive.
 *
 * Wrapped rather than used directly because `after()` throws outside a request
 * scope — which is exactly where unit tests run. The fallback keeps those
 * callers working instead of forcing every test to mock `next/server`.
 *
 * The work must never throw: after the response there is nothing left to turn
 * an error into, so failures are logged and swallowed.
 */
export function runAfterResponse(fn: () => Promise<unknown>, tag: string): void {
  const guarded = () =>
    Promise.resolve()
      .then(fn)
      .catch((error) => logError(tag, error));

  try {
    nextAfter(guarded);
  } catch {
    // No request scope (tests, scripts, background jobs) — a floating promise
    // is the best available approximation.
    void guarded();
  }
}
