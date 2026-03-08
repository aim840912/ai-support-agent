import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: {
      count: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
    },
  },
}));

import { createCreateTicketTool } from "@/lib/ai/tools/create-ticket";
import { prisma } from "@/lib/db";

const mockCount = vi.mocked(prisma.ticket.count);
const mockCreate = vi.mocked(prisma.ticket.create);
const mockOrderFindFirst = vi.mocked(prisma.order.findFirst);

const fakeTicket = {
  ticketNumber: "TKT-1001",
  subject: "My order is late",
  priority: "high",
  status: "open",
};

describe("createCreateTicketTool", () => {
  const orgId = "org-789";

  beforeEach(() => vi.resetAllMocks());

  it("creates a ticket successfully with correct ticketNumber", async () => {
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce(fakeTicket as any);
    mockOrderFindFirst.mockResolvedValueOnce(null);

    const tool = createCreateTicketTool(orgId);
    const result = await (tool as any).execute({
      subject: "My order is late",
      description: "The order has not arrived.",
      priority: "high",
      orderId: null,
    });

    expect(result.success).toBe(true);
    expect(result.ticketId).toBe("TKT-1001");
    expect(result.message).toMatch(/TKT-1001/);
  });

  it("sets SLA based on priority (urgent = 2h)", async () => {
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce({ ...fakeTicket, priority: "urgent" } as any);
    mockOrderFindFirst.mockResolvedValueOnce(null);

    const tool = createCreateTicketTool(orgId);
    const result = await (tool as any).execute({
      subject: "Critical issue",
      description: "System down.",
      priority: "urgent",
      orderId: null,
    });

    expect(result.message).toMatch(/2 hours/);
  });

  it("retries on ticketNumber collision (P2002 error)", async () => {
    // First count: 0 → TKT-1001 conflicts; second count: 0 → TKT-1002 succeeds
    mockCount.mockResolvedValue(0);
    const p2002 = new PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "0",
    });
    mockCreate
      .mockRejectedValueOnce(p2002) // attempt 1 fails
      .mockResolvedValueOnce({ ...fakeTicket, ticketNumber: "TKT-1002" } as any); // attempt 2 succeeds
    mockOrderFindFirst.mockResolvedValueOnce(null);

    const tool = createCreateTicketTool(orgId);
    const result = await (tool as any).execute({
      subject: "Retry test",
      description: "Collision handling",
      priority: "low",
      orderId: null,
    });

    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("resolves orderId from order number when provided", async () => {
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce(fakeTicket as any);
    mockOrderFindFirst.mockResolvedValueOnce({ id: "order-db-id-123" } as any);

    const tool = createCreateTicketTool(orgId);
    await (tool as any).execute({
      subject: "Order issue",
      description: "Problem with ORD-001",
      priority: "medium",
      orderId: "ORD-001",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: "order-db-id-123" }),
      })
    );
  });
});
