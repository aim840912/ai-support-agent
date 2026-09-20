import { prisma } from "@/lib/db";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { runAfterResponse } from "@/lib/after";
import { dispatchWebhooks } from "@/lib/webhooks/dispatch";
import { buildEvent, toTicketCreatedData } from "@/lib/webhooks/events";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

/** Where the ticket came from. Travels into the webhook payload. */
export type TicketSource = "agent" | "mcp" | "dashboard" | "api";

export type CreateTicketInput = {
  subject: string;
  description: string;
  priority: TicketPriority;
  /** Human-readable order number (ORD-001); resolved to the internal id here. */
  orderNumber?: string | null;
  source?: TicketSource;
};

export type CreatedTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  source: TicketSource;
  slaHours: number;
  createdAt: Date;
};

/** Response-time commitment quoted back to the customer. */
export function slaHoursFor(priority: string): number {
  if (priority === "urgent") return 2;
  if (priority === "high") return 4;
  return 24;
}

/**
 * Race condition mitigation: `count` and `create` are not atomic, so two
 * concurrent requests can read the same count and collide on the unique
 * `ticketNumber` constraint. Retry up to 5 times, incrementing the offset on
 * each conflict.
 */
async function createTicketWithUniqueNumber(data: {
  subject: string;
  description: string;
  priority: string;
  status: string;
  orgId: string;
  orderId: string | null;
}) {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const count = await prisma.ticket.count({ where: { orgId: data.orgId } });
    const ticketNumber = `TKT-${1000 + count + 1 + attempt}`;

    try {
      return await prisma.ticket.create({ data: { ...data, ticketNumber } });
    } catch (err) {
      // P2002 = unique constraint violation — retry with the next number
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to generate a unique ticket number after ${MAX_ATTEMPTS} attempts`);
}

/**
 * The single place a ticket is written.
 *
 * It exists because outbound webhooks have to fire on *every* creation path,
 * and there are already two (the agent tool and MCP) with a dashboard form
 * likely to follow. Leaving the logic inside one caller guarantees the others
 * eventually forget to notify.
 */
export async function createTicket(
  orgId: string,
  input: CreateTicketInput
): Promise<CreatedTicket> {
  const { subject, description, priority, orderNumber, source = "agent" } = input;

  // Order numbers are what customers say out loud; the FK needs the row id.
  // Scoped by orgId so one tenant cannot attach a ticket to another's order.
  let resolvedOrderId: string | null = null;
  if (orderNumber) {
    const order = await prisma.order.findFirst({
      where: { orderNumber: orderNumber.toUpperCase(), orgId },
      select: { id: true },
    });
    resolvedOrderId = order?.id ?? null;
  }

  const ticket = await createTicketWithUniqueNumber({
    subject,
    description,
    priority,
    status: "open",
    orgId,
    orderId: resolvedOrderId,
  });

  const created: CreatedTicket = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    orderId: ticket.orderId,
    orderNumber: orderNumber?.toUpperCase() ?? null,
    source,
    slaHours: slaHoursFor(ticket.priority),
    createdAt: ticket.createdAt,
  };

  // Notification is secondary to the ticket existing. Scheduling it after the
  // response keeps a slow or dead receiver from delaying the customer's reply,
  // and runAfterResponse swallows failures so a webhook can never turn a
  // successful ticket into an error.
  runAfterResponse(
    () =>
      dispatchWebhooks(orgId, "ticket.created", () =>
        buildEvent("ticket.created", orgId, toTicketCreatedData(created))
      ),
    "[tickets/createTicket] webhook dispatch"
  );

  return created;
}
