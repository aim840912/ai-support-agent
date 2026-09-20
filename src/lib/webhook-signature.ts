import { createHmac, randomBytes } from "crypto";
import { secureCompareHex } from "@/lib/api-key";

/**
 * Signing for outbound webhooks.
 *
 * Nothing in this file touches the database, the network or Next — which is
 * the point: it is the one part of the delivery path that can be tested
 * exhaustively, so it is also the part worth getting exactly right.
 */

export const ID_HEADER = "x-webhook-id";
export const EVENT_HEADER = "x-webhook-event";
export const TIMESTAMP_HEADER = "x-webhook-timestamp";
export const SIGNATURE_HEADER = "x-webhook-signature";

/** How far a timestamp may drift before a delivery is rejected. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

const SECRET_PREFIX = "whsec_";

/**
 * A shared secret for one endpoint. Prefixed so it is distinguishable from the
 * widget key (`sk_`) and machine credentials (`mcp_`) at a glance in logs.
 */
export function generateWebhookSecret(): string {
  return `${SECRET_PREFIX}${randomBytes(24).toString("base64url")}`;
}

function computeSignature(rawBody: string, secret: string, timestamp: number): string {
  // The timestamp is inside the signed material, not merely alongside it.
  // Signing the body alone would let an intercepted (body, signature) pair be
  // replayed forever.
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * Produces the `X-Webhook-Signature` value: `t=<unix>,v1=<hex>`.
 *
 * Timestamp and digest travel in ONE header on purpose. Splitting them invites
 * the classic mistake of checking the freshness of one value while verifying a
 * digest computed over another. The shape also matches Stripe and Svix, so a
 * receiver's existing snippet usually works unchanged.
 */
export function signPayload(
  rawBody: string,
  secret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000)
): { header: string; timestamp: number } {
  const signature = computeSignature(rawBody, secret, timestampSeconds);
  return {
    header: `t=${timestampSeconds},v1=${signature}`,
    timestamp: timestampSeconds,
  };
}

export type VerifyResult =
  | { valid: true }
  | { valid: false; reason: "malformed" | "expired" | "mismatch" };

/**
 * Verifies a signature header against the raw body.
 *
 * Exported mainly so the documented receiver snippet is real code rather than
 * prose, and so the tests can prove the properties that matter.
 *
 * `nowSeconds` is injectable so the expiry window is testable without fake
 * timers.
 */
export function verifySignature(
  rawBody: string,
  header: string,
  secret: string,
  opts: { toleranceSeconds?: number; nowSeconds?: number } = {}
): VerifyResult {
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  const parts = new Map<string, string>();
  for (const segment of header.split(",")) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;
    parts.set(segment.slice(0, idx).trim(), segment.slice(idx + 1).trim());
  }

  const rawTimestamp = parts.get("t");
  const presented = parts.get("v1");
  if (!rawTimestamp || !presented) return { valid: false, reason: "malformed" };

  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp)) return { valid: false, reason: "malformed" };

  // Rejected in both directions: a future timestamp is as much a sign of
  // tampering as a stale one.
  if (Math.abs(now - timestamp) > tolerance) return { valid: false, reason: "expired" };

  const expected = computeSignature(rawBody, secret, timestamp);
  // secureCompareHex checks length before timingSafeEqual, which throws on
  // mismatched buffers.
  return secureCompareHex(expected, presented)
    ? { valid: true }
    : { valid: false, reason: "mismatch" };
}

/**
 * Note on wording used in the docs: the timestamp buys replay *resistance*,
 * not prevention. Preventing replay requires the receiver to deduplicate on
 * X-Webhook-Id, which is why that header is sent and why the n8n example
 * demonstrates it.
 */
