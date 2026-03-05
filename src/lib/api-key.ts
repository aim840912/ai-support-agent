import { randomBytes, createHash } from "crypto";

/**
 * Generate a cryptographically secure API key for widget authentication.
 *
 * Format: sk_<32 bytes of random data, base64url-encoded>
 * Example: sk_aB3xZq9mKpLnRwYt2sUvOiGhFeDcJbNk
 *
 * Why not cuid()?
 *   cuid() is designed for collision resistance, NOT unpredictability.
 *   Its output is partially time-based and sequential, meaning an attacker
 *   who observes one cuid can narrow down the search space for others.
 *   crypto.randomBytes() provides 256 bits of true randomness — computationally
 *   infeasible to brute force.
 */
export function generateApiKey(): string {
  return `sk_${randomBytes(32).toString("base64url")}`;
}

/**
 * Compute the SHA-256 hash of a raw API key.
 *
 * Store this in Organization.apiKeyHash instead of using the raw key for
 * authentication lookups. If the database is compromised (SQL injection,
 * backup leak, insider access), the attacker obtains hashes — which cannot
 * be used directly to call the widget API.
 *
 * Usage:
 *   // At creation time:
 *   const raw = generateApiKey();
 *   const hash = hashApiKey(raw);
 *   await prisma.organization.create({ data: { apiKey: raw, apiKeyHash: hash, ... } });
 *
 *   // At auth time (widget/chat route):
 *   const hash = hashApiKey(incomingKey);
 *   const org = await prisma.organization.findFirst({ where: { apiKeyHash: hash } });
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}
