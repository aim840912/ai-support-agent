import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";

const VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

const createSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const params = request.nextUrl.searchParams;

  const rawStatus = params.get("status");
  const status =
    rawStatus && VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
      ? rawStatus
      : undefined;

  try {
    const orders = await prisma.order.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200, // Guard against OOM on large datasets — use cursor pagination for exports
      include: {
        items: {
          include: { product: { select: { name: true, sku: true } } },
        },
        _count: { select: { tickets: true } },
      },
    });

    const data = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      trackingNumber: o.trackingNumber,
      estimatedDelivery: o.estimatedDelivery?.toISOString() ?? null,
      totalPrice: o.totalPrice,
      customerId: o.customerId,
      ticketCount: o._count.tickets,
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: o.createdAt.toISOString(),
    }));

    return Response.json(data);
  } catch (error) {
    logError("[OrdersAPI GET]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const { customerId, items, trackingNumber, estimatedDelivery } = parsed.data;

    // Verify all products belong to this org
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, orgId },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return Response.json({ error: "One or more products not found" }, { status: 404 });
    }

    const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // Generate a unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId,
        totalPrice,
        trackingNumber,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        orgId,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });

    return Response.json(
      { id: order.id, orderNumber: order.orderNumber, totalPrice: order.totalPrice },
      { status: 201 }
    );
  } catch (error) {
    logError("[OrdersAPI POST]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
