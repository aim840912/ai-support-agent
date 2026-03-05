import { randomBytes } from "crypto";

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
