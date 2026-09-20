/**
 * The base URL third parties should call back on.
 *
 * NEXT_PUBLIC_APP_URL is the deployed origin. Local development needs an
 * override because Telegram (and any webhook receiver) cannot reach
 * localhost: a tunnel gives a different hostname on every restart, and
 * baking that into NEXT_PUBLIC_APP_URL would also rewrite the widget embed
 * snippet and the sitemap.
 */
export function getPublicBaseUrl(): string {
  // The last resort differs by environment on purpose. Falling back to
  // localhost in production is silently wrong rather than loudly broken: a
  // deployed build kept emitting http://localhost:3000 as the dashboardUrl in
  // webhook payloads because neither variable was set, and every local test
  // passed because localhost happened to be the right answer there.
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://ai-support-agent-tau.vercel.app"
      : "http://localhost:3000";

  const raw = process.env.INTEGRATIONS_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? fallback;
  return raw.replace(/\/+$/, "");
}

/**
 * True when the base URL is something a third party can actually reach.
 * Telegram rejects a non-HTTPS webhook outright, so it is worth saying so
 * before the call rather than surfacing its error.
 */
export function isPubliclyReachable(url: string = getPublicBaseUrl()): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return !["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}
