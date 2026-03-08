import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { createCheckInventoryTool } from "@/lib/ai/tools/check-inventory";
import { prisma } from "@/lib/db";

const mockFindFirst = vi.mocked(prisma.product.findFirst);
const mockFindMany = vi.mocked(prisma.product.findMany);

const fakeProduct = {
  sku: "AUDIO-WNC-BLK",
  name: "Wireless Noise-Cancelling Headphones",
  stockLevel: 42,
  warehouse: "WH-A1",
  reorderThreshold: 10,
};

describe("createCheckInventoryTool — SKU exact match", () => {
  const orgId = "org-456";

  beforeEach(() => vi.clearAllMocks());

  it("returns product details on exact SKU match", async () => {
    mockFindFirst.mockResolvedValueOnce(fakeProduct as any);

    const tool = createCheckInventoryTool(orgId);
    const result = await (tool as any).execute({ productId: "AUDIO-WNC-BLK" });

    expect(result.found).toBe(true);
    expect(result.sku).toBe("AUDIO-WNC-BLK");
    expect(result.stockLevel).toBe(42);
    expect(result.inStock).toBe(true);
    expect(result.lowStock).toBe(false);
  });

  it("marks lowStock=true when stockLevel <= reorderThreshold", async () => {
    const lowStockProduct = { ...fakeProduct, stockLevel: 5 };
    mockFindFirst.mockResolvedValueOnce(lowStockProduct as any);

    const tool = createCheckInventoryTool(orgId);
    const result = await (tool as any).execute({ productId: "AUDIO-WNC-BLK" });

    expect(result.lowStock).toBe(true);
    expect(result.inStock).toBe(true);
  });

  it("marks inStock=false when stockLevel is 0", async () => {
    const outOfStock = { ...fakeProduct, stockLevel: 0 };
    mockFindFirst.mockResolvedValueOnce(outOfStock as any);

    const tool = createCheckInventoryTool(orgId);
    const result = await (tool as any).execute({ productId: "AUDIO-WNC-BLK" });

    expect(result.inStock).toBe(false);
  });
});

describe("createCheckInventoryTool — name fuzzy fallback", () => {
  const orgId = "org-456";

  beforeEach(() => vi.clearAllMocks());

  it("falls back to name search when exact SKU not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null); // no exact SKU match
    mockFindMany.mockResolvedValueOnce([fakeProduct] as any);

    const tool = createCheckInventoryTool(orgId);
    const result = await (tool as any).execute({ productId: "wireless headphones" });

    expect(result.found).toBe(true);
    expect(result.name).toBe("Wireless Noise-Cancelling Headphones");
  });

  it("returns found=false when no SKU or name match", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);

    const tool = createCheckInventoryTool(orgId);
    const result = await (tool as any).execute({ productId: "nonexistent-product" });

    expect(result.found).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });
});
