import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  try {
    // Fetch all sessions + messages in parallel.
    // take limits prevent OOM on Pro orgs with unbounded data accumulation —
    // analytics aggregations are approximate for very large datasets, which
    // is an acceptable trade-off versus a single request exhausting server memory.
    const [sessions, messages] = await Promise.all([
      prisma.chatSession.findMany({
        where: { orgId },
        select: {
          id: true,
          source: true,
          createdAt: true,
          _count: { select: { messages: true } },
        },
        take: 1000,
      }),
      prisma.chatMessage.findMany({
        where: { session: { orgId } },
        select: { toolCalls: true, createdAt: true },
        take: 5000,
      }),
    ]);

    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((acc, s) => acc + s._count.messages, 0);
    const avgMessagesPerSession =
      totalSessions > 0
        ? Math.round((totalMessages / totalSessions) * 10) / 10
        : 0;

    // Daily conversations — group by date string (JS-side aggregation)
    const dailyMap: Record<string, number> = {};
    for (const s of sessions) {
      const date = s.createdAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      dailyMap[date] = (dailyMap[date] ?? 0) + 1;
    }
    const dailyConversations = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30) // last 30 days
      .map(([date, count]) => ({ date, count }));

    // Source distribution — group by source
    const sourceMap: Record<string, number> = {};
    for (const s of sessions) {
      sourceMap[s.source] = (sourceMap[s.source] ?? 0) + 1;
    }
    const sourceDistribution = Object.entries(sourceMap).map(([source, count]) => ({
      source,
      count,
    }));

    // Tool usage — parse toolCalls JSON field
    const toolMap: Record<string, number> = {};
    for (const msg of messages) {
      if (!msg.toolCalls) continue;
      const calls = Array.isArray(msg.toolCalls)
        ? msg.toolCalls
        : typeof msg.toolCalls === "object"
        ? [msg.toolCalls]
        : [];

      for (const call of calls as { toolName?: string; name?: string }[]) {
        const name = call.toolName ?? call.name ?? "unknown";
        toolMap[name] = (toolMap[name] ?? 0) + 1;
      }
    }
    const toolUsage = Object.entries(toolMap)
      .sort(([, a], [, b]) => b - a)
      .map(([tool, count]) => ({ tool, count }));

    return Response.json({
      overview: { totalSessions, totalMessages, avgMessagesPerSession },
      dailyConversations,
      sourceDistribution,
      toolUsage,
    });
  } catch (error) {
    logError("[AnalyticsAPI]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
