import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Factory that creates a checkInventory tool scoped to the given org.
 * Queries products from the database with SKU exact-match or name fuzzy-match.
 */
export function createCheckInventoryTool(orgId: string) {
  return tool({
    description:
      "Check the inventory level for a specific product. Returns stock quantity, warehouse location, and reorder status.",
    inputSchema: z.object({
      productId: z
        .string()
        .describe(
          "The product SKU to check (e.g., AUDIO-WNC-BLK), or a partial product name to search."
        ),
    }),
    execute: async ({ productId }) => {
      // Try exact SKU match first
      const exactMatch = await prisma.product.findFirst({
        where: {
          sku: productId.toUpperCase(),
          orgId,
        },
      });

      if (exactMatch) {
        return {
          found: true,
          productId: exactMatch.sku,
          name: exactMatch.name,
          stockLevel: exactMatch.stockLevel,
          warehouse: exactMatch.warehouse,
          sku: exactMatch.sku,
          reorderThreshold: exactMatch.reorderThreshold,
          inStock: exactMatch.stockLevel > 0,
          lowStock: exactMatch.stockLevel <= exactMatch.reorderThreshold,
        };
      }

      // Fallback: case-insensitive partial name search
      const nameMatches = await prisma.product.findMany({
        where: {
          name: { contains: productId, mode: "insensitive" },
          orgId,
        },
        take: 1,
      });

      const nameMatch = nameMatches[0];

      if (nameMatch) {
        return {
          found: true,
          productId: nameMatch.sku,
          name: nameMatch.name,
          stockLevel: nameMatch.stockLevel,
          warehouse: nameMatch.warehouse,
          sku: nameMatch.sku,
          reorderThreshold: nameMatch.reorderThreshold,
          inStock: nameMatch.stockLevel > 0,
          lowStock: nameMatch.stockLevel <= nameMatch.reorderThreshold,
        };
      }

      return {
        found: false,
        productId,
        message: `Product "${productId}" not found in inventory system.`,
      };
    },
  });
}
