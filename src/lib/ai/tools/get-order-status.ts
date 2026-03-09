import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Factory that creates a getOrderStatus tool scoped to the given org.
 * Looks up orders from the database (multi-tenant isolated by orgId).
 */
export function createGetOrderStatusTool(orgId: string) {
  return tool({
    description:
      "Look up the status of a customer order by order number. Returns order details including status, tracking number, and estimated delivery date. 透過訂單號查詢客戶訂單狀態，回傳狀態、追蹤號碼和預計送達日期。",
    inputSchema: z.object({
      orderId: z
        .string()
        .describe("The order number to look up (e.g., ORD-001). If unknown, ask the customer."),
    }),
    execute: async ({ orderId }) => {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: orderId.toUpperCase(),
          orgId,
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!order) {
        return {
          found: false,
          orderId,
          message: `Order ${orderId} not found. Please verify the order number and try again.`,
        };
      }

      // Build a concise product summary for the first item (primary product)
      const primaryItem = order.items[0];

      return {
        found: true,
        orderId: order.orderNumber,
        status: order.status,
        product: primaryItem?.product.name ?? "Unknown product",
        quantity: primaryItem?.quantity ?? 0,
        price: order.totalPrice.toNumber(),
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery
          ? order.estimatedDelivery.toISOString().split("T")[0]
          : null,
        createdAt: order.createdAt.toISOString().split("T")[0],
      };
    },
  });
}
