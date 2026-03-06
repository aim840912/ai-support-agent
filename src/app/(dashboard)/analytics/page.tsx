import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { MessageSquare, MessagesSquare, Wrench } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  ConversationsChart,
  SourceDistribution,
  ToolUsageChart,
} from "@/components/dashboard/analytics-charts";

// JS-side aggregation helpers
function getDailyConversations(
  sessions: { createdAt: Date }[]
): { date: string; count: number }[] {
  const dailyMap: Record<string, number> = {};
  for (const s of sessions) {
    const date = s.createdAt.toISOString().slice(0, 10);
    dailyMap[date] = (dailyMap[date] ?? 0) + 1;
  }
  return Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, count]) => ({ date, count }));
}

function getSourceDistribution(
  sessions: { source: string }[]
): { source: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const s of sessions) {
    map[s.source] = (map[s.source] ?? 0) + 1;
  }
  return Object.entries(map).map(([source, count]) => ({ source, count }));
}

function getToolUsage(
  messages: { toolCalls: unknown }[]
): { tool: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const msg of messages) {
    if (!msg.toolCalls) continue;
    const calls = Array.isArray(msg.toolCalls)
      ? msg.toolCalls
      : [msg.toolCalls];
    for (const call of calls as { toolName?: string; name?: string }[]) {
      const name = call.toolName ?? call.name ?? "unknown";
      map[name] = (map[name] ?? 0) + 1;
    }
  }
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([tool, count]) => ({ tool, count }));
}

export default async function AnalyticsPage() {
  const session = await auth();
  const orgId = session?.user?.orgId;

  const [sessions, messages] = await Promise.all([
    prisma.chatSession.findMany({
      where: { orgId },
      select: {
        source: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.chatMessage.findMany({
      where: { session: { orgId } },
      select: { toolCalls: true },
    }),
  ]);

  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((acc, s) => acc + s._count.messages, 0);
  const avgMessages =
    totalSessions > 0
      ? Math.round((totalMessages / totalSessions) * 10) / 10
      : 0;

  const dailyConversations = getDailyConversations(sessions);
  const sourceDistribution = getSourceDistribution(sessions);
  const toolUsage = getToolUsage(messages);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Conversation metrics and insights
      </p>

      {/* Overview stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Conversations"
          value={totalSessions}
          description="All sessions across sources"
          Icon={MessageSquare}
        />
        <StatCard
          title="Total Messages"
          value={totalMessages}
          description="User + assistant messages"
          Icon={MessagesSquare}
        />
        <StatCard
          title="Avg Messages / Session"
          value={avgMessages}
          description="Average depth per conversation"
          Icon={Wrench}
        />
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-medium text-foreground">
            Daily Conversations (last 30 days)
          </h2>
          <ConversationsChart data={dailyConversations} />
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-medium text-foreground">
            Source Distribution
          </h2>
          <SourceDistribution data={sourceDistribution} />
        </div>

        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-foreground">
            Tool Usage
          </h2>
          <ToolUsageChart data={toolUsage} />
        </div>
      </div>
    </div>
  );
}
