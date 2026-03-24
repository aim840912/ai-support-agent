/**
 * Demo account helpers — server-side only.
 * DEMO_EMAIL is intentionally not a public env var to avoid leaking into the
 * client JS bundle (even though it's not a secret, it's cleaner this way).
 */
export const DEMO_EMAIL = "demo@ai-support-agent.local";

export function isDemoUser(email?: string | null): boolean {
  return email === DEMO_EMAIL;
}
