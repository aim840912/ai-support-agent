import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

/**
 * Attempts to create a ticket with a sequential ticket number.
 *
 * Race condition mitigation: `count` and `create` are not atomic, so two
 * concurrent requests can get the same count and collide on the unique
 * `ticketNumber` constraint. We retry up to 5 times, incrementing the offset
 * on each conflict, to safely resolve the collision.
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
      return await prisma.ticket.create({
        data: { ...data, ticketNumber },
      });
    } catch (err) {
      // P2002 = unique constraint violation — retry with next number
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to generate a unique ticket number after ${MAX_ATTEMPTS} attempts`);
}

/**
 * Factory that creates a createTicket tool scoped to the given org.
 * Persists support tickets to the database.
 */
export function createCreateTicketTool(orgId: string) {
  return tool({
    description:
      "Create a support ticket when an issue cannot be resolved immediately. Use this when the customer's problem requires human review or escalation.",
    inputSchema: z.object({
      subject: z.string().describe("Brief subject line for the ticket"),
      description: z
        .string()
        .describe(
          "Detailed description of the issue including what the customer reported and any relevant context"
        ),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .describe(
          "Ticket priority: low (general inquiry), medium (standard issue), high (significant impact), urgent (critical/time-sensitive)"
        ),
      orderId: z
        .string()
        .optional()
        .describe(
          "Related order number (e.g., ORD-001) if applicable, or omit if not related to an order"
        ),
    }),
    execute: async ({ subject, description, priority, orderId }) => {
      // Resolve order DB ID from order number if provided
      let resolvedOrderId: string | null = null;
      if (orderId) {
        const order = await prisma.order.findFirst({
          where: { orderNumber: orderId.toUpperCase(), orgId },
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

      const slaHours = priority === "urgent" ? 2 : priority === "high" ? 4 : 24;

      return {
        success: true,
        ticketId: ticket.ticketNumber,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        message: `Support ticket ${ticket.ticketNumber} has been created. Our team will review it and respond within ${slaHours} hours.`,
      };
    },
  });
}
