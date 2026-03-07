import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TicketList } from "@/components/dashboard/ticket-list";
import { logError } from "@/lib/error-logger";

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

type ValidStatus = (typeof VALID_STATUSES)[number];
type ValidPriority = (typeof VALID_PRIORITIES)[number];

function isValidStatus(s: string): s is ValidStatus {
  return VALID_STATUSES.includes(s as ValidStatus);
}

function isValidPriority(p: string): p is ValidPriority {
  return VALID_PRIORITIES.includes(p as ValidPriority);
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const resolvedParams = await searchParams;

  const rawStatus = resolvedParams.status;
  const rawPriority = resolvedParams.priority;

  const status =
    typeof rawStatus === "string" && isValidStatus(rawStatus)
      ? rawStatus
      : undefined;

  const priority =
    typeof rawPriority === "string" && isValidPriority(rawPriority)
      ? rawPriority
      : undefined;

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        orgId: session.user.orgId,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { orderNumber: true } },
        _count: { select: { notes: true } },
      },
    });

    const serialized = tickets.map((t) => ({
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

    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage support tickets created by customers and the AI agent
        </p>

        <div className="mt-8">
          <TicketList
            tickets={serialized}
            activeStatus={status}
            activePriority={priority}
          />
        </div>
      </div>
    );
  } catch (error) {
    logError("[TicketsPage]", error);
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage support tickets created by customers and the AI agent
        </p>
        <p className="mt-8 text-sm text-destructive">
          Failed to load tickets. Please try again later.
        </p>
      </div>
    );
  }
}
