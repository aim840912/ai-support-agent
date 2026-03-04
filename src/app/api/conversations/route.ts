import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const source = request.nextUrl.searchParams.get("source");

  const sessions = await prisma.chatSession.findMany({
    where: {
      orgId,
      ...(source ? { source } : {}),
    },
    orderBy: { createdAt: "desc" },
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
}
