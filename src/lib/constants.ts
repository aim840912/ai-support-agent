/**
 * Shared application constants used across API routes and pages.
 */

// Whitelist of valid chat session sources.
// Centralised here to keep conversations/route.ts, conversations/export/route.ts,
// and the conversations page in sync — previously duplicated in all three files.
export const VALID_SOURCES = ["widget", "dashboard", "api"] as const;
export type ValidSource = (typeof VALID_SOURCES)[number];

/**
 * Type guard that returns true if `s` is one of the three known source values.
 * Rejects arbitrary strings to prevent unintended Prisma filter behaviour.
 */
export function isValidSource(s: string): s is ValidSource {
  return VALID_SOURCES.includes(s as ValidSource);
}
