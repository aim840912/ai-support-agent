import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";

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
        .nullable()
        .optional()
        .describe("Related order number (e.g., ORD-001) if applicable"),
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

      // Generate sequential ticket number within this org
      const ticketCount = await prisma.ticket.count({ where: { orgId } });
      const ticketNumber = `TKT-${1000 + ticketCount + 1}`;

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          subject,
          description,
          priority,
          status: "open",
          orgId,
          orderId: resolvedOrderId,
        },
      });

      const slaHours =
        priority === "urgent" ? 2 : priority === "high" ? 4 : 24;

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
