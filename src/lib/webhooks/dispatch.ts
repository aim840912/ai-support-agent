import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";
import {
  signPayload,
  ID_HEADER,
  EVENT_HEADER,
  TIMESTAMP_HEADER,
  SIGNATURE_HEADER,
} from "@/lib/webhook-signature";
import type { WebhookEvent, WebhookEventName } from "./events";

/** Per-attempt timeout. Two attempts must still fit inside one invocation. */
const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS ?? 4000);
const MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? 2);
const RETRY_BACKOFF_MS = 500;

/** Consecutive failures before an endpoint is switched off. */
export const FAILURE_THRESHOLD = 10;

/** Delivery records kept per endpoint. This is a debugging aid, not an audit log. */
export const DELIVERY_HISTORY_LIMIT = 20;

const REQUEST_BODY_LIMIT = 2000;
const RESPONSE_BODY_LIMIT = 500;

export type DeliveryResult = {
  ok: boolean;
  statusCode: number | null;
  durationMs: number;
  attempt: number;
  error?: string;
};

export type DeliverableEndpoint = {
  id: string;
  url: string;
  secret: string;
  orgId: string;
};

export type UrlCheck = { ok: true } | { ok: false; reason: string };

const PRIVATE_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/;

/**
 * Rejects destinations that would make the server fetch its own network.
 *
 * The URL is attacker-controllable in the sense that any tenant can set it, so
 * this is the standard SSRF guard. It is deliberately checked twice — when the
 * endpoint is saved and again at delivery time — because a hostname that
 * resolved publicly at save time can be repointed afterwards.
 *
 * Honest limitation: this inspects the literal host. A name that resolves to a
 * private address still passes. Closing that needs resolution plus a pinned
 * socket, which is beyond what this project takes on.
 */
export function validateWebhookUrl(raw: string): UrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }

  const isDev = process.env.NODE_ENV !== "production";

  if (parsed.protocol !== "https:" && !(isDev && parsed.protocol === "http:")) {
    return { ok: false, reason: "Webhook URLs must use HTTPS." };
  }

  const host = parsed.hostname.toLowerCase();
  const loopback = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"].includes(host);

  // Local automation tools (an n8n container, for instance) are the normal
  // case in development, so loopback is allowed there and only there.
  if (loopback) {
    return isDev
      ? { ok: true }
      : { ok: false, reason: "Webhook URLs cannot point at this server." };
  }

  if (PRIVATE_V4.test(host) || host.endsWith(".internal") || host.endsWith(".local")) {
    return { ok: false, reason: "Webhook URLs cannot point at a private network address." };
  }

  return { ok: true };
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…[truncated]` : value;
}

/** 4xx other than 429 means the receiver understood and refused — don't repeat it. */
function isRetryable(statusCode: number | null): boolean {
  if (statusCode === null) return true; // network failure or timeout
  if (statusCode === 429) return true;
  return statusCode >= 500;
}

/**
 * Delivers one event to one endpoint and records the outcome.
 *
 * Also used by the dashboard's "Send test event" and resend buttons, so the
 * thing being exercised there is the real delivery path rather than a
 * simulation of it.
 */
export async function deliverOnce(
  endpoint: DeliverableEndpoint,
  event: WebhookEvent
): Promise<DeliveryResult> {
  const body = JSON.stringify(event);
  const { header, timestamp } = signPayload(body, endpoint.secret);

  const urlCheck = validateWebhookUrl(endpoint.url);
  if (!urlCheck.ok) {
    const result: DeliveryResult = {
      ok: false,
      statusCode: null,
      durationMs: 0,
      attempt: 1,
      error: urlCheck.reason,
    };
    await recordDelivery(endpoint, event, body, result, null);
    return result;
  }

  let last: DeliveryResult = { ok: false, statusCode: null, durationMs: 0, attempt: 1 };
  let responseBody: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ai-support-agent-webhooks/1.0",
          [ID_HEADER]: event.id,
          [EVENT_HEADER]: event.event,
          [TIMESTAMP_HEADER]: String(timestamp),
          [SIGNATURE_HEADER]: header,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      responseBody = await response.text().catch(() => null);
      last = {
        ok: response.ok,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        attempt,
      };
    } catch (error) {
      last = {
        ok: false,
        statusCode: null,
        durationMs: Date.now() - startedAt,
        attempt,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }

    if (last.ok || !isRetryable(last.statusCode) || attempt === MAX_ATTEMPTS) break;
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
  }

  await recordDelivery(endpoint, event, body, last, responseBody);
  return last;
}

async function recordDelivery(
  endpoint: DeliverableEndpoint,
  event: WebhookEvent,
  requestBody: string,
  result: DeliveryResult,
  responseBody: string | null
): Promise<void> {
  try {
    await prisma.webhookDelivery.create({
      data: {
        event: event.event,
        eventId: event.id,
        status: result.ok ? "success" : "failed",
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        attempt: result.attempt,
        error: result.error ?? null,
        requestBody: truncate(requestBody, REQUEST_BODY_LIMIT),
        responseBody: responseBody ? truncate(responseBody, RESPONSE_BODY_LIMIT) : null,
        endpointId: endpoint.id,
        orgId: endpoint.orgId,
      },
    });

    // A dead endpoint would otherwise consume an attempt on every event
    // forever. Auto-disabling makes that visible instead of silent.
    if (result.ok) {
      await prisma.webhookEndpoint.updateMany({
        where: { id: endpoint.id, orgId: endpoint.orgId },
        data: { failureCount: 0, lastStatus: result.statusCode, lastFiredAt: new Date() },
      });
    } else {
      const updated = await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          failureCount: { increment: 1 },
          lastStatus: result.statusCode ?? 0,
          lastFiredAt: new Date(),
        },
        select: { failureCount: true },
      });
      if (updated.failureCount >= FAILURE_THRESHOLD) {
        await prisma.webhookEndpoint.updateMany({
          where: { id: endpoint.id, orgId: endpoint.orgId },
          data: { enabled: false },
        });
      }
    }

    await trimDeliveryHistory(endpoint.id);
  } catch (error) {
    // Bookkeeping must never be the reason a delivery is reported as failed.
    logError("[webhooks/recordDelivery]", error);
  }
}

/** Keeps only the newest DELIVERY_HISTORY_LIMIT records for an endpoint. */
async function trimDeliveryHistory(endpointId: string): Promise<void> {
  const keep = await prisma.webhookDelivery.findMany({
    where: { endpointId },
    orderBy: { createdAt: "desc" },
    take: DELIVERY_HISTORY_LIMIT,
    select: { id: true },
  });
  if (keep.length < DELIVERY_HISTORY_LIMIT) return;

  await prisma.webhookDelivery.deleteMany({
    where: { endpointId, id: { notIn: keep.map((row) => row.id) } },
  });
}

/**
 * Fans an event out to every enabled endpoint subscribed to it.
 *
 * Never throws: a webhook is a notification, and failing to notify must not
 * fail the operation that triggered it.
 *
 * Delivery guarantee, stated plainly: this is at-most-a-few-attempts, not
 * at-least-once. There is no background worker on this platform, and `after()`
 * is not durable — a crash loses the event. The production answer is a durable
 * queue, and the seam for it is right here: replace the deliverOnce call with
 * an enqueue and nothing else moves.
 */
export async function dispatchWebhooks(
  orgId: string,
  event: WebhookEventName,
  buildPayload: () => WebhookEvent
): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { orgId, enabled: true, events: { has: event } },
      select: { id: true, url: true, secret: true, orgId: true },
    });
    if (endpoints.length === 0) return;

    const payload = buildPayload();
    await Promise.all(
      endpoints.map((endpoint) =>
        deliverOnce(endpoint, payload).catch((error) =>
          logError("[webhooks/dispatch] delivery", error)
        )
      )
    );
  } catch (error) {
    logError("[webhooks/dispatch]", error);
  }
}
