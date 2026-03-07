import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

type ValidStatus = (typeof VALID_STATUSES)[number];
type ValidPriority = (typeof VALID_PRIORITIES)[number];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const params = request.nextUrl.searchParams;

  const rawStatus = params.get("status");
  const rawPriority = params.get("priority");

  const status: ValidStatus | undefined =
    rawStatus && VALID_STATUSES.includes(rawStatus as ValidStatus)
      ? (rawStatus as ValidStatus)
      : undefined;

  const priority: ValidPriority | undefined =
    rawPriority && VALID_PRIORITIES.includes(rawPriority as ValidPriority)
      ? (rawPriority as ValidPriority)
      : undefined;

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { orderNumber: true } },
        _count: { select: { notes: true } },
      },
    });

    const data = tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      status: t.status,
      orderId: t.orderId,
      orderNumber: t.order?.orderNumber ?? null,
      noteCount: t._count.notes,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return Response.json(data);
  } catch (error) {
    console.error("[TicketsAPI GET]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
