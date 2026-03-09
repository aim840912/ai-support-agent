import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ConversationList } from "@/components/dashboard/conversation-list";
import { logError } from "@/lib/error-logger";
import { isValidSource, type ValidSource } from "@/lib/constants";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const resolvedParams = await searchParams;

  const rawSource = resolvedParams.source;
  const source: ValidSource | undefined =
    typeof rawSource === "string" && isValidSource(rawSource) ? rawSource : undefined;

  try {
    const sessions = await prisma.chatSession.findMany({
      where: {
        orgId: session.user.orgId,
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
        <p className="mt-1 text-sm text-muted-foreground">View all customer conversations</p>

        <div className="mt-8">
          <ConversationList sessions={serialized} activeSource={source} />
        </div>
      </div>
    );
  } catch (error) {
    logError("[ConversationsPage]", error);
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Conversations</h1>
        <p className="mt-1 text-sm text-muted-foreground">View all customer conversations</p>
        <p className="mt-8 text-sm text-destructive">
          Failed to load conversations. Please try again later.
        </p>
      </div>
    );
  }
}
