import { tool } from "ai";
import { z } from "zod";
import { mockInventory } from "../mock-data";

export const checkInventory = tool({
  description:
    "Check the inventory level for a specific product. Returns stock quantity, warehouse location, and reorder status.",
  inputSchema: z.object({
    productId: z
      .string()
      .describe(
        "The product ID to check inventory for (e.g., PROD-001). Can also search by partial product name."
      ),
  }),
  execute: async ({ productId }) => {
    // Try exact match first, then case-insensitive partial match on name
    const exactMatch = mockInventory[productId.toUpperCase()];
    if (exactMatch) {
      return {
        found: true,
        ...exactMatch,
        inStock: exactMatch.stockLevel > 0,
        lowStock: exactMatch.stockLevel <= exactMatch.reorderThreshold,
      };
    }

    // Fallback: search by product name substring
    const nameMatch = Object.values(mockInventory).find((item) =>
      item.name.toLowerCase().includes(productId.toLowerCase())
    );

    if (nameMatch) {
      return {
        found: true,
        ...nameMatch,
        inStock: nameMatch.stockLevel > 0,
        lowStock: nameMatch.stockLevel <= nameMatch.reorderThreshold,
      };
    }

    return {
      found: false,
      productId,
      message: `Product ${productId} not found in inventory system.`,
    };
  },
});
