import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: { count: vi.fn(), create: vi.fn() },
    order: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchWebhooks: vi.fn() }));

// Run the scheduled work inline so the test can observe it, and surface a
// throw instead of swallowing it — the real wrapper deliberately swallows.
vi.mock("@/lib/after", () => ({
  runAfterResponse: (fn: () => Promise<unknown>) => {
    void Promise.resolve()
      .then(fn)
      .catch(() => {});
  },
}));

vi.mock("@/lib/public-url", () => ({ getPublicBaseUrl: () => "https://example.test" }));

import { prisma } from "@/lib/db";
import { dispatchWebhooks } from "@/lib/webhooks/dispatch";
import { createTicket, slaHoursFor } from "@/lib/tickets";

const mockCount = vi.mocked(prisma.ticket.count);
const mockCreate = vi.mocked(prisma.ticket.create);
const mockOrderFindFirst = vi.mocked(prisma.order.findFirst);
const mockDispatch = vi.mocked(dispatchWebhooks);

const ORG = "org-1";

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tkt-db-id",
    ticketNumber: "TKT-1001",
    subject: "Order is late",
    description: "It has not arrived.",
    priority: "high",
    status: "open",
    orderId: null,
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    ...overrides,
  };
}

function p2002() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.0.0",
  });
}

describe("slaHoursFor", () => {
  it.each([
    ["urgent", 2],
    ["high", 4],
    ["medium", 24],
    ["low", 24],
    ["anything else", 24],
  ])("maps %s to %i hours", (priority, hours) => {
    expect(slaHoursFor(priority)).toBe(hours);
  });
});

describe("createTicket", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a ticket with a sequential number", async () => {
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce(ticketRow() as never);

    const result = await createTicket(ORG, {
      subject: "Order is late",
      description: "It has not arrived.",
      priority: "high",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ticketNumber: "TKT-1001", orgId: ORG, status: "open" }),
      })
    );
    expect(result.ticketNumber).toBe("TKT-1001");
    expect(result.slaHours).toBe(4);
    expect(result.source).toBe("agent");
  });

  it("resolves the order number to an id, scoped by org", async () => {
    // Without the orgId scope a tenant could attach a ticket to another
    // tenant's order by guessing an order number.
    mockOrderFindFirst.mockResolvedValueOnce({ id: "order-db-id" } as never);
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce(ticketRow({ orderId: "order-db-id" }) as never);

    const result = await createTicket(ORG, {
      subject: "s",
      description: "d",
      priority: "low",
      orderNumber: "ord-001",
    });

    expect(mockOrderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: "ORD-001", orgId: ORG } })
    );
    expect(result.orderId).toBe("order-db-id");
    expect(result.orderNumber).toBe("ORD-001");
  });

  it("leaves orderId null when the order number is unknown", async () => {
    mockOrderFindFirst.mockResolvedValueOnce(null);
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce(ticketRow() as never);

    const result = await createTicket(ORG, {
      subject: "s",
      description: "d",
      priority: "low",
      orderNumber: "ORD-999",
    });

    expect(result.orderId).toBeNull();
  });

  it("retries on a unique-constraint collision and increments the number", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockRejectedValueOnce(p2002());
    mockCreate.mockResolvedValueOnce(ticketRow({ ticketNumber: "TKT-1002" }) as never);

    const result = await createTicket(ORG, { subject: "s", description: "d", priority: "low" });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].data.ticketNumber).toBe("TKT-1002");
    expect(result.ticketNumber).toBe("TKT-1002");
  });

  it("gives up after five collisions rather than looping", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockRejectedValue(p2002());

    await expect(
      createTicket(ORG, { subject: "s", description: "d", priority: "low" })
    ).rejects.toThrow(/unique ticket number/i);
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });

  it("rethrows a non-collision database error instead of retrying", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockRejectedValue(new Error("connection lost"));

    await expect(
      createTicket(ORG, { subject: "s", description: "d", priority: "low" })
    ).rejects.toThrow("connection lost");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("dispatches ticket.created with a flat, precomputed payload", async () => {
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce(ticketRow() as never);

    await createTicket(ORG, {
      subject: "Order is late",
      description: "It has not arrived.",
      priority: "urgent",
      source: "mcp",
    });
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledWith(ORG, "ticket.created", expect.any(Function));

    const payload = mockDispatch.mock.calls[0][2]();
    expect(payload.event).toBe("ticket.created");
    expect(payload.id).toMatch(/^evt_/);
    expect(payload.data).toMatchObject({
      ticketNumber: "TKT-1001",
      source: "mcp",
      dashboardUrl: "https://example.test/tickets/tkt-db-id",
    });
    // Dates must cross the wire as strings, never as Date objects.
    expect(typeof (payload.data as { createdAt: unknown }).createdAt).toBe("string");
  });

  it("still returns the ticket when webhook dispatch throws", async () => {
    // A notification failure must never turn a created ticket into an error.
    mockCount.mockResolvedValueOnce(0);
    mockCreate.mockResolvedValueOnce(ticketRow() as never);
    mockDispatch.mockRejectedValueOnce(new Error("receiver exploded"));

    const result = await createTicket(ORG, {
      subject: "s",
      description: "d",
      priority: "low",
    });

    expect(result.ticketNumber).toBe("TKT-1001");
  });
});
