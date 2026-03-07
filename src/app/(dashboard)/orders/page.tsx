import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrderList } from "@/components/dashboard/order-list";

const VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: string): s is ValidStatus {
  return VALID_STATUSES.includes(s as ValidStatus);
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const resolvedParams = await searchParams;
  const rawStatus = resolvedParams.status;
  const status =
    typeof rawStatus === "string" && isValidStatus(rawStatus) ? rawStatus : undefined;

  try {
    const orders = await prisma.order.findMany({
      where: {
        orgId: session.user.orgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: { select: { quantity: true } },
        _count: { select: { tickets: true } },
      },
    });

    const serialized = orders.map((o) => ({
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

    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage customer orders
        </p>

        <div className="mt-8">
          <OrderList orders={serialized} activeStatus={status} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[OrdersPage]", error);
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage customer orders
        </p>
        <p className="mt-8 text-sm text-destructive">
          Failed to load orders. Please try again later.
        </p>
      </div>
    );
  }
}
