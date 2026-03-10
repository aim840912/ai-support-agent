import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";

const VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

const patchSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.string().datetime().optional(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    const order = await prisma.order.findFirst({
      where: { id, orgId },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true, price: true } },
          },
        },
        tickets: {
          select: { id: true, ticketNumber: true, subject: true, status: true, priority: true },
        },
      },
    });

    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    return Response.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: order.estimatedDelivery?.toISOString() ?? null,
      totalPrice: order.totalPrice.toNumber(),
      customerId: order.customerId,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        subtotal: item.quantity * item.unitPrice.toNumber(),
      })),
      tickets: order.tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
      })),
    });
  } catch (error) {
    logError("[OrdersAPI GET/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const { status, trackingNumber, estimatedDelivery } = parsed.data;

    // updateMany with orgId — atomic authorization + mutation, eliminates TOCTOU
    // race between the previous findFirst (with orgId) and update (with id only).
    const result = await prisma.order.updateMany({
      where: { id, orgId },
      data: {
        ...(status ? { status } : {}),
        ...(trackingNumber !== undefined ? { trackingNumber } : {}),
        ...(estimatedDelivery ? { estimatedDelivery: new Date(estimatedDelivery) } : {}),
      },
    });

    if (result.count === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Fetch updated record for response — updateMany does not return updated rows.
    // Use findFirst with orgId to keep the read scoped to the same tenant.
    const order = await prisma.order.findFirst({
      where: { id, orgId },
      select: { id: true, status: true, trackingNumber: true, estimatedDelivery: true },
    });

    return Response.json({
      id: order!.id,
      status: order!.status,
      trackingNumber: order!.trackingNumber,
      estimatedDelivery: order!.estimatedDelivery?.toISOString() ?? null,
    });
  } catch (error) {
    logError("[OrdersAPI PATCH/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
