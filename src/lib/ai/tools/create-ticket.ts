import { tool } from "ai";
import { z } from "zod";
import { createTicket } from "@/lib/tickets";

export const createTicketDescription =
  "Create a support ticket when an issue cannot be resolved immediately. Use this when the customer's problem requires human review or escalation. 當問題無法立即解決時建立客服工單，用於需要人工審查或升級處理的情況。";

export const createTicketInputSchema = z.object({
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
});

export type CreateTicketToolInput = z.infer<typeof createTicketInputSchema>;

/**
 * Plain runner: no AI SDK, no HTTP. Shared by the chat agent and the MCP
 * server so both go through the same write path and the same notifications.
 */
export async function runCreateTicket(orgId: string, input: CreateTicketToolInput) {
  const ticket = await createTicket(orgId, {
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    orderNumber: input.orderId ?? null,
    source: "agent",
  });

  return {
    success: true,
    ticketId: ticket.ticketNumber,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    message: `Support ticket ${ticket.ticketNumber} has been created. Our team will review it and respond within ${ticket.slaHours} hours.`,
  };
}

/**
 * Factory that creates a createTicket tool scoped to the given org.
 * Persists support tickets to the database.
 */
export function createCreateTicketTool(orgId: string) {
  return tool({
    description: createTicketDescription,
    inputSchema: createTicketInputSchema,
    execute: (input) => runCreateTicket(orgId, input),
  });
}
