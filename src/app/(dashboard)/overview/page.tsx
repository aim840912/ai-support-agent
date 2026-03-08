import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { MessageSquare, FileText, Package, Ticket } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { QuickStartCard } from "@/components/dashboard/quick-start-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOrgUsage } from "@/lib/plan/check-plan-limit";
import { getPlanLimits } from "@/lib/plan/limits";
import { formatTimeAgo } from "@/lib/utils";
import { logError } from "@/lib/error-logger";

// ─── AI Tool display metadata ──────────────────────────────────────────────
const TOOL_DISPLAY: Record<string, { label: string; requiresPro: boolean }> = {
  searchKnowledgeBase: { label: "KB Search", requiresPro: false },
  getOrderStatus: { label: "Order Status", requiresPro: false },
  checkInventory: { label: "Inventory", requiresPro: true },
  createTicket: { label: "Tickets", requiresPro: true },
};

// Canonical tool order for the status card
const TOOL_ORDER = ["searchKnowledgeBase", "getOrderStatus", "checkInventory", "createTicket"];

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const { orgId } = session.user;

  try {
    // Fetch org plan first so we can pass it to getOrgUsage (avoids extra DB round-trip)
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    const plan = org?.plan ?? "free";
    const limits = getPlanLimits(plan);

    const [usage, recentSessions] = await Promise.all([
      getOrgUsage(orgId, plan),
      prisma.chatSession.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          _count: { select: { messages: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { content: true, role: true },
          },
        },
      }),
    ]);

    const { conversationsThisMonth, documents, products, ticketsThisMonth } = usage.usage;
    const hasDocuments = documents > 0;

    // Conversation limit display (–1 = unlimited)
    const convLimit =
      limits.conversationsPerMonth === -1
        ? "unlimited"
        : `of ${limits.conversationsPerMonth}/month`;

    // Document limit display
    const docDisplay =
      limits.documents === -1 ? String(documents) : `${documents} / ${limits.documents}`;

    // Product limit display
    const prodDisplay =
      limits.products === -1 ? String(products) : `${products} / ${limits.products}`;

    // Ticket limit display
    const ticketLimit =
      limits.ticketsPerMonth === -1 ? "unlimited" : `of ${limits.ticketsPerMonth}/month`;

    return (
      <div>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your AI support agent at a glance</p>

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Conversations"
            value={conversationsThisMonth}
            description={convLimit}
            Icon={MessageSquare}
            iconBg="bg-indigo-100 dark:bg-indigo-950/50"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            title="Documents"
            value={docDisplay}
            description="Knowledge base files"
            Icon={FileText}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            title="Products"
            value={prodDisplay}
            description="Inventory items"
            Icon={Package}
            iconBg="bg-amber-100 dark:bg-amber-950/50"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            title="Tickets"
            value={ticketsThisMonth}
            description={ticketLimit}
            Icon={Ticket}
            iconBg="bg-rose-100 dark:bg-rose-950/50"
            iconColor="text-rose-600 dark:text-rose-400"
          />
        </div>

        {/* ── Quick Start ─────────────────────────────────────────────────── */}
        <div className="mt-6">
          <QuickStartCard enabledTools={limits.enabledTools} hasDocuments={hasDocuments} />
        </div>

        {/* ── Two-column: Recent Conversations + AI Tool Status ──────────── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Recent Conversations */}
          <Card className="border border-border shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Recent Conversations
              </CardTitle>
              <Link
                href="/conversations"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No conversations yet. Try the{" "}
                  <Link href="/playground" className="font-medium text-foreground hover:underline">
                    Playground
                  </Link>{" "}
                  to start chatting.
                </p>
              ) : (
                <ul className="space-y-3" role="list">
                  {recentSessions.map((s) => {
                    const firstMsg = s.messages[0];
                    const preview = firstMsg
                      ? firstMsg.content.slice(0, 60) + (firstMsg.content.length > 60 ? "…" : "")
                      : "No messages";

                    return (
                      <li
                        key={s.id}
                        className="flex flex-col gap-0.5 rounded-md p-2 transition-colors hover:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {s.source}
                          </Badge>
                          <span className="truncate text-sm text-foreground">
                            &ldquo;{preview}&rdquo;
                          </span>
                        </div>
                        <p className="pl-1 text-xs text-muted-foreground">
                          {s._count.messages} msg
                          {s._count.messages !== 1 ? "s" : ""} &middot; {formatTimeAgo(s.createdAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* AI Tool Status */}
          <Card className="border border-border shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                AI Tool Status
              </CardTitle>
              <Link
                href="/settings"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Configure
              </Link>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3" role="list">
                {TOOL_ORDER.map((toolKey) => {
                  const meta = TOOL_DISPLAY[toolKey];
                  if (!meta) return null;

                  const isEnabled = limits.enabledTools.includes(toolKey);

                  return (
                    <li key={toolKey} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-sm text-foreground">{meta.label}</span>
                      </div>
                      <Badge variant={isEnabled ? "secondary" : "outline"} className="text-xs">
                        {isEnabled ? "Active" : "Pro"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    logError("[OverviewPage]", error);
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your AI support agent at a glance</p>
        <p className="mt-8 text-sm text-destructive">
          Failed to load overview data. Please try again later.
        </p>
      </div>
    );
  }
}
