import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const getOrderStatusDescription =
  "Look up the status of a customer order by order number. Returns order details including status, tracking number, and estimated delivery date. 透過訂單號查詢客戶訂單狀態，回傳狀態、追蹤號碼和預計送達日期。";

export const getOrderStatusInputSchema = z.object({
  orderId: z
    .string()
    .describe("The order number to look up (e.g., ORD-001). If unknown, ask the customer."),
});

export type GetOrderStatusInput = z.infer<typeof getOrderStatusInputSchema>;

/**
 * Plain runner: no AI SDK, no HTTP. The chat agent and the MCP server call
 * this same function, so a tool cannot behave differently depending on which
 * surface invoked it.
 */
export async function runGetOrderStatus(orgId: string, { orderId }: GetOrderStatusInput) {
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
    // Decimal must be converted before it crosses a JSON boundary, or it
    // serialises as a string.
    price: order.totalPrice.toNumber(),
    trackingNumber: order.trackingNumber,
    estimatedDelivery: order.estimatedDelivery
      ? order.estimatedDelivery.toISOString().split("T")[0]
      : null,
    createdAt: order.createdAt.toISOString().split("T")[0],
  };
}

/**
 * Factory that creates a getOrderStatus tool scoped to the given org.
 * Looks up orders from the database (multi-tenant isolated by orgId).
 */
export function createGetOrderStatusTool(orgId: string) {
  return tool({
    description: getOrderStatusDescription,
    inputSchema: getOrderStatusInputSchema,
    execute: (input) => runGetOrderStatus(orgId, input),
  });
}
