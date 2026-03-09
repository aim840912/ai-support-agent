import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";
import { VALID_SOURCES, isValidSource, type ValidSource } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  const rawSource = request.nextUrl.searchParams.get("source");
  const source: ValidSource | undefined =
    rawSource && isValidSource(rawSource) ? rawSource : undefined;

  try {
    const sessions = await prisma.chatSession.findMany({
      where: {
        orgId,
        ...(source ? { source } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200, // Guard against OOM on large datasets — use cursor pagination for exports
      include: {
        _count: { select: { messages: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { content: true, role: true },
        },
      },
    });

    // Serialize dates for client consumption
    const data = sessions.map((s) => ({
      id: s.id,
      source: s.source,
      visitorId: s.visitorId,
      userId: s.userId,
      createdAt: s.createdAt.toISOString(),
      messageCount: s._count.messages,
      firstMessage: s.messages[0]?.content ?? null,
    }));

    return Response.json(data);
  } catch (error) {
    logError("[ConversationsAPI]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
