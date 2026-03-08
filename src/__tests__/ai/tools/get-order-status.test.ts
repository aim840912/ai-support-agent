import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the entire @/lib/db module before importing the tool factory
vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
    },
  },
}));

import { createGetOrderStatusTool } from "@/lib/ai/tools/get-order-status";
import { prisma } from "@/lib/db";

const mockFindFirst = vi.mocked(prisma.order.findFirst);

describe("createGetOrderStatusTool", () => {
  const orgId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns found=false when order does not exist", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const tool = createGetOrderStatusTool(orgId);
    // Access execute via the tool definition
    const result = await (tool as any).execute({ orderId: "ORD-999" });

    expect(result.found).toBe(false);
    expect(result.orderId).toBe("ORD-999");
    expect(result.message).toMatch(/ORD-999/);
  });

  it("returns order details when order exists", async () => {
    const fakeOrder = {
      orderNumber: "ORD-001",
      status: "shipped",
      totalPrice: 99.99,
      trackingNumber: "TRACK-XYZ",
      estimatedDelivery: new Date("2026-03-15"),
      createdAt: new Date("2026-03-01"),
      items: [
        {
          quantity: 2,
          product: { name: "Wireless Headphones" },
        },
      ],
    };
    mockFindFirst.mockResolvedValueOnce(fakeOrder as any);

    const tool = createGetOrderStatusTool(orgId);
    const result = await (tool as any).execute({ orderId: "ORD-001" });

    expect(result.found).toBe(true);
    expect(result.orderId).toBe("ORD-001");
    expect(result.status).toBe("shipped");
    expect(result.product).toBe("Wireless Headphones");
    expect(result.quantity).toBe(2);
    expect(result.trackingNumber).toBe("TRACK-XYZ");
    expect(result.estimatedDelivery).toBe("2026-03-15");
  });

  it("normalises orderId to uppercase when querying", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const tool = createGetOrderStatusTool(orgId);
    await (tool as any).execute({ orderId: "ord-001" });

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orderNumber: "ORD-001", orgId }),
      })
    );
  });

  it("handles order with no items gracefully", async () => {
    const fakeOrder = {
      orderNumber: "ORD-002",
      status: "pending",
      totalPrice: 50,
      trackingNumber: null,
      estimatedDelivery: null,
      createdAt: new Date("2026-03-08"),
      items: [],
    };
    mockFindFirst.mockResolvedValueOnce(fakeOrder as any);

    const tool = createGetOrderStatusTool(orgId);
    const result = await (tool as any).execute({ orderId: "ORD-002" });

    expect(result.found).toBe(true);
    expect(result.product).toBe("Unknown product");
    expect(result.quantity).toBe(0);
    expect(result.estimatedDelivery).toBeNull();
  });
});
