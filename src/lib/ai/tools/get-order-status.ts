import { tool } from "ai";
import { z } from "zod";
import { mockOrders } from "../mock-data";

export const getOrderStatus = tool({
  description:
    "Look up the status of a customer order by order ID. Returns order details including status, tracking number, and estimated delivery date.",
  inputSchema: z.object({
    orderId: z
      .string()
      .describe(
        "The order ID to look up (e.g., ORD-001). If unknown, ask the customer."
      ),
  }),
  execute: async ({ orderId }) => {
    const order = mockOrders[orderId.toUpperCase()];

    if (!order) {
      return {
        found: false,
        orderId,
        message: `Order ${orderId} not found. Please verify the order ID and try again.`,
      };
    }

    return {
      found: true,
      orderId: order.orderId,
      status: order.status,
      product: order.product,
      quantity: order.quantity,
      price: order.price,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: order.estimatedDelivery,
      createdAt: order.createdAt,
    };
  },
});
