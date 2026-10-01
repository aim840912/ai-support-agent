import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";
import { isDemoUser } from "@/lib/demo";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (isDemoUser(session.user.email)) {
    return Response.json({ error: "Demo account cannot delete data" }, { status: 403 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    // deleteMany with orgId in the where clause eliminates the TOCTOU race
    // (findUnique → orgId check → delete) and also removes the 404 vs 403
    // information leak that allowed session ID enumeration across orgs.
    // Cascade delete — ChatMessage rows removed automatically via FK constraint.
    const { count } = await prisma.chatSession.deleteMany({
      where: { id, orgId },
    });

    if (count === 0) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logError("[ConversationDeleteAPI]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    // findFirst with both id + orgId: a session from another org returns the
    // same 404 as a missing one, so ids can't be enumerated across tenants.
    // Every tenant-scoped `{ id, orgId }` read in this codebase uses findFirst.
    const chatSession = await prisma.chatSession.findFirst({
      where: { id, orgId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            toolCalls: true,
          },
        },
      },
    });

    if (!chatSession) {
      return new Response("Not found", { status: 404 });
    }

    return Response.json({
      id: chatSession.id,
      source: chatSession.source,
      visitorId: chatSession.visitorId,
      createdAt: chatSession.createdAt.toISOString(),
      messages: chatSession.messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logError("[ConversationGetAPI]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
