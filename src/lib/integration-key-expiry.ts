/**
 * Expiry choices for MCP integration keys.
 *
 * Lives outside the integrations actions file because a "use server" module
 * may only export async functions, and the client form needs the same list
 * the server validates against.
 */

/** Days until expiry; null = never. The first entry is the form default. */
export const KEY_EXPIRY_OPTIONS = [90, 30, 365, null] as const;
export type KeyExpiryDays = (typeof KEY_EXPIRY_OPTIONS)[number];

export function isKeyExpiryDays(value: unknown): value is KeyExpiryDays {
  return (KEY_EXPIRY_OPTIONS as readonly unknown[]).includes(value);
}

export function computeExpiresAt(days: KeyExpiryDays, now = new Date()): Date | null {
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Matches the check in resolveOrgByIntegrationKey: expired at or after the instant. */
export function isKeyExpired(expiresAt: Date | null, now = Date.now()): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now;
}
