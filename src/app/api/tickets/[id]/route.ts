import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const patchSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  priority: z.enum(VALID_PRIORITIES).optional(),
  note: z.string().min(1).max(2000).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id, orgId },
      include: {
        order: { select: { orderNumber: true, status: true } },
        notes: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!ticket) {
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    return Response.json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      orderId: ticket.orderId,
      orderNumber: ticket.order?.orderNumber ?? null,
      orderStatus: ticket.order?.status ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      notes: ticket.notes.map((n) => ({
        id: n.id,
        content: n.content,
        authorId: n.authorId,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logError("[TicketsAPI GET/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId || !session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId, id: userId } = session.user;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const { status, priority, note } = parsed.data;

    // Verify ownership before mutating
    const existing = await prisma.ticket.findFirst({ where: { id, orgId } });
    if (!existing) {
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Run status/priority update + optional note creation in a transaction
    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        },
      });

      if (note) {
        await tx.ticketNote.create({
          data: { content: note, authorId: userId, ticketId: id },
        });
      }

      return updated;
    });

    return Response.json({
      id: ticket.id,
      status: ticket.status,
      priority: ticket.priority,
      updatedAt: ticket.updatedAt.toISOString(),
    });
  } catch (error) {
    logError("[TicketsAPI PATCH/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
