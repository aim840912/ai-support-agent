import { randomBytes } from "crypto";
import type { CreatedTicket } from "@/lib/tickets";
import { getPublicBaseUrl } from "@/lib/public-url";

/** Events an endpoint can subscribe to. */
export const WEBHOOK_EVENTS = ["ticket.created"] as const;
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(value: string): value is WebhookEventName {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

/**
 * The envelope every delivery shares.
 *
 * Envelope fields stay separate from `data` so a second event type cannot
 * collide with a domain field of the first — and so a receiver can route on
 * `event` without knowing any payload shape.
 */
export type WebhookEvent<T = unknown> = {
  id: string;
  event: WebhookEventName;
  createdAt: string;
  orgId: string;
  data: T;
};

export function buildEvent<T>(event: WebhookEventName, orgId: string, data: T): WebhookEvent<T> {
  return {
    id: `evt_${randomBytes(12).toString("base64url")}`,
    event,
    createdAt: new Date().toISOString(),
    orgId,
    data,
  };
}

export type TicketCreatedData = {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  slaHours: number;
  orderNumber: string | null;
  source: string;
  createdAt: string;
  dashboardUrl: string;
};

/**
 * Shapes a ticket for delivery.
 *
 * Three deliberate choices, all aimed at whoever wires this into an
 * automation tool:
 *  - one level of nesting, so an expression is `data.ticketNumber` rather
 *    than a path three deep;
 *  - every value a string or number, never a Date or a Prisma Decimal, both
 *    of which serialise into shapes that surprise the receiver;
 *  - `slaHours` and `dashboardUrl` precomputed, so the receiving workflow
 *    doesn't have to re-derive business rules or assemble URLs.
 */
export function toTicketCreatedData(ticket: CreatedTicket): TicketCreatedData {
  return {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    slaHours: ticket.slaHours,
    orderNumber: ticket.orderNumber,
    source: ticket.source,
    createdAt: ticket.createdAt.toISOString(),
    dashboardUrl: `${getPublicBaseUrl()}/tickets/${ticket.id}`,
  };
}
