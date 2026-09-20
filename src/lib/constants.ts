/**
 * Shared application constants used across API routes and pages.
 */

// Whitelist of valid chat session sources.
// Centralised here to keep conversations/route.ts, conversations/export/route.ts,
// and the conversations page in sync — previously duplicated in all three files.
export const VALID_SOURCES = ["widget", "dashboard", "api", "telegram"] as const;
export type ValidSource = (typeof VALID_SOURCES)[number];

/**
 * Type guard that returns true if `s` is one of the known source values.
 * Rejects arbitrary strings to prevent unintended Prisma filter behaviour.
 *
 * This list doubles as the channel registry: adding a value here makes the new
 * channel selectable in the conversations API, the export endpoint and the
 * dashboard filter at once. That is the whole of the "channel abstraction" —
 * a per-channel interface would add a second dispatch layer on top of the file
 * router without earning anything.
 */
export function isValidSource(s: string): s is ValidSource {
  return VALID_SOURCES.includes(s as ValidSource);
}
