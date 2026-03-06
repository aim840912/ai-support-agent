import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  // Whitelist valid sources — reject arbitrary strings to prevent unintended
  // Prisma filter behaviour and avoid leaking schema-level source values.
  const VALID_SOURCES = ["widget", "dashboard", "api"] as const;
  type ValidSource = (typeof VALID_SOURCES)[number];
  const rawSource = request.nextUrl.searchParams.get("source");
  const source: ValidSource | undefined =
    rawSource && VALID_SOURCES.includes(rawSource as ValidSource)
      ? (rawSource as ValidSource)
      : undefined;

  try {
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
  } catch (error) {
    console.error("[ConversationsAPI]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
