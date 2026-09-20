import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const checkInventoryDescription =
  "Check the inventory level for a specific product. Returns stock quantity, warehouse location, and reorder status. 查詢特定商品的庫存量、倉庫位置和補貨狀態。";

export const checkInventoryInputSchema = z.object({
  productId: z
    .string()
    .describe(
      "The product SKU to check (e.g., AUDIO-WNC-BLK), or a partial product name to search."
    ),
});

export type CheckInventoryInput = z.infer<typeof checkInventoryInputSchema>;

type ProductRow = {
  sku: string;
  name: string;
  stockLevel: number;
  warehouse: string;
  reorderThreshold: number;
};

function describe(product: ProductRow) {
  return {
    found: true,
    productId: product.sku,
    name: product.name,
    stockLevel: product.stockLevel,
    warehouse: product.warehouse,
    sku: product.sku,
    reorderThreshold: product.reorderThreshold,
    inStock: product.stockLevel > 0,
    lowStock: product.stockLevel <= product.reorderThreshold,
  };
}

/**
 * Plain runner shared by the chat agent and the MCP server.
 *
 * Two-stage lookup on purpose: customers quote SKUs when they have them and
 * describe the product when they don't, so an exact match is tried first and
 * a name search only as a fallback.
 */
export async function runCheckInventory(orgId: string, { productId }: CheckInventoryInput) {
  const exactMatch = await prisma.product.findFirst({
    where: {
      sku: productId.toUpperCase(),
      orgId,
    },
  });

  if (exactMatch) return describe(exactMatch);

  const nameMatches = await prisma.product.findMany({
    where: {
      name: { contains: productId, mode: "insensitive" },
      orgId,
    },
    take: 1,
  });

  const nameMatch = nameMatches[0];
  if (nameMatch) return describe(nameMatch);

  return {
    found: false,
    productId,
    message: `Product "${productId}" not found in inventory system.`,
  };
}

/**
 * Factory that creates a checkInventory tool scoped to the given org.
 * Queries products from the database with SKU exact-match or name fuzzy-match.
 */
export function createCheckInventoryTool(orgId: string) {
  return tool({
    description: checkInventoryDescription,
    inputSchema: checkInventoryInputSchema,
    execute: (input) => runCheckInventory(orgId, input),
  });
}
