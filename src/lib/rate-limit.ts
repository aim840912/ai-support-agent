/**
 * In-memory sliding window rate limiter.
 *
 * Works correctly in local development and long-running Node.js servers.
 * NOTE: For production serverless (Vercel), each function instance has its
 * own memory — limits are per-instance, not global. For true global rate
 * limiting in serverless, upgrade to Upstash Redis:
 *   pnpm add @upstash/ratelimit @upstash/redis
 */

type WindowRecord = {
  timestamps: number[];
};

// In-memory store: identifier → list of request timestamps
const store = new Map<string, WindowRecord>();

// Upper bound for any configured window (1h = longest window in use).
// Used by maybePruneStore to purge timestamps that are expired across all limiters.
const MAX_WINDOW_MS = 3_600_000;

// Periodic cleanup to prevent unbounded memory growth.
// Previous version only deleted entries with zero timestamps — entries that
// still held old (but expired) timestamps were never cleaned up, causing slow
// memory growth in long-running processes.
let lastCleanup = Date.now();
function maybePruneStore() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  const globalCutoff = now - MAX_WINDOW_MS;
  for (const [key, record] of store.entries()) {
    // Drop timestamps older than the maximum possible window
    record.timestamps = record.timestamps.filter((t) => t > globalCutoff);
    if (record.timestamps.length === 0) store.delete(key);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RateLimiter = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  success: boolean;  // false → request should be rejected with 429
  remaining: number; // how many requests are left in the current window
  reset: number;     // Unix timestamp (seconds) when the window resets
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a rate limiter configuration.
 * @param limit   Number of allowed requests per window
 * @param window  Window duration: "30s" | "1m" | "15m" | "1h"
 */
export function createRateLimiter(opts: {
  limit: number;
  window: string;
}): RateLimiter {
  return { limit: opts.limit, windowMs: parseWindow(opts.window) };
}

function parseWindow(w: string): number {
  const m = w.match(/^(\d+)(s|m|h)$/);
  if (!m) throw new Error(`Invalid rate limit window: "${w}". Use e.g. "15m", "1h"`);
  const n = parseInt(m[1], 10);
  if (m[2] === "s") return n * 1_000;
  if (m[2] === "m") return n * 60_000;
  if (m[2] === "h") return n * 3_600_000;
  throw new Error(`Unknown time unit: ${m[2]}`);
}

// ─── Check ────────────────────────────────────────────────────────────────────

/**
 * Check and consume one token for the given identifier.
 * Returns { success: false } when the limit is exceeded.
 */
export async function checkRateLimit(
  limiter: RateLimiter,
  identifier: string
): Promise<RateLimitResult> {
  maybePruneStore();

  const now = Date.now();
  const windowStart = now - limiter.windowMs;

  const record = store.get(identifier) ?? { timestamps: [] };

  // Slide: drop timestamps outside the current window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  const currentCount = record.timestamps.length;
  const success = currentCount < limiter.limit;
  const remaining = Math.max(0, limiter.limit - currentCount - (success ? 1 : 0));

  if (success) {
    record.timestamps.push(now);
    store.set(identifier, record);
  }

  // reset = when the oldest in-window request expires
  const oldest = record.timestamps[0];
  const reset = oldest
    ? Math.ceil((oldest + limiter.windowMs) / 1000)
    : Math.ceil((now + limiter.windowMs) / 1000);

  return { success, remaining, reset };
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/**
 * Build a standard 429 Too Many Requests response.
 */
export function rateLimitResponse(reset: number): Response {
  const retryAfter = Math.max(0, reset - Math.floor(Date.now() / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(reset),
      },
    }
  );
}

/**
 * Extract the client IP from standard proxy headers.
 * Falls back to "unknown" when no IP is detectable.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
