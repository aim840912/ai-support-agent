import { tool } from "ai";
import { z } from "zod";
import { createMockTicket } from "../mock-data";

export const createTicket = tool({
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
      .describe("Related order ID if applicable"),
  }),
  execute: async ({ subject, description, priority, orderId }) => {
    const ticket = createMockTicket({
      subject,
      description,
      priority,
      orderId: orderId ?? null,
    });

    return {
      success: true,
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      message: `Support ticket ${ticket.ticketId} has been created. Our team will review it and respond within ${
        priority === "urgent" ? "2 hours" : priority === "high" ? "4 hours" : "24 hours"
      }.`,
    };
  },
});
