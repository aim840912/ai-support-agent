import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ConversationList } from "@/components/dashboard/conversation-list";

const VALID_SOURCES = ["widget", "dashboard", "api"] as const;
type Source = (typeof VALID_SOURCES)[number];

function isValidSource(s: string): s is Source {
  return VALID_SOURCES.includes(s as Source);
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const resolvedParams = await searchParams;

  const rawSource = resolvedParams.source;
  const source =
    typeof rawSource === "string" && isValidSource(rawSource)
      ? rawSource
      : undefined;

  const sessions = await prisma.chatSession.findMany({
    where: {
      orgId: session?.user?.orgId,
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

  const serialized = sessions.map((s) => ({
    id: s.id,
    source: s.source,
    visitorId: s.visitorId,
    userId: s.userId,
    createdAt: s.createdAt.toISOString(),
    messageCount: s._count.messages,
    firstMessage: s.messages[0]?.content ?? null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Conversations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        View all customer conversations
      </p>

      <div className="mt-8">
        <ConversationList sessions={serialized} activeSource={source} />
      </div>
    </div>
  );
}
