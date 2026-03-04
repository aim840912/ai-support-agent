export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type Ticket = {
  ticketId: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: string;
  orderId: string | null;
  createdAt: string;
};

// In-memory mutable store — simulates a real ticketing system
const ticketStore: Ticket[] = [
  {
    ticketId: "TKT-1000",
    subject: "Headphones not pairing",
    description: "Cannot pair with Bluetooth on MacBook Pro.",
    priority: "medium",
    status: "in_progress",
    customerId: "CUST-001",
    orderId: "ORD-001",
    createdAt: "2024-01-16",
  },
];

let nextTicketNumber = 1001;

export function createMockTicket(input: {
  subject: string;
  description: string;
  priority: TicketPriority;
  customerId?: string;
  orderId?: string | null;
}): Ticket {
  const ticket: Ticket = {
    ticketId: `TKT-${nextTicketNumber++}`,
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    status: "open",
    customerId: input.customerId ?? "CUST-ANON",
    orderId: input.orderId ?? null,
    createdAt: new Date().toISOString().split("T")[0],
  };
  ticketStore.push(ticket);
  return ticket;
}

export function getMockTickets(): Ticket[] {
  return [...ticketStore];
}
