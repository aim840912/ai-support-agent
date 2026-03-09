import Link from "next/link";
import type { getOrgUsage } from "@/lib/plan/check-plan-limit";
import { UpgradeButton } from "./upgrade-button";

export type UsageData = Awaited<ReturnType<typeof getOrgUsage>>;

function UsageStat({ label, current, limit }: { label: string; current: number; limit: number }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isNear = !unlimited && pct >= 80;
  const isAt = !unlimited && pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {current} / {unlimited ? "Unlimited" : limit}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              isAt ? "bg-red-500" : isNear ? "bg-amber-400" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label={label}
          />
        </div>
      )}
    </div>
  );
}

export function PlanUsageSection({
  usage,
  stripePortalUrl,
}: {
  usage: UsageData;
  stripePortalUrl?: string;
}) {
  const { plan, limits, usage: stats } = usage;

  return (
    <div className="max-w-lg space-y-8">
      {/* Plan badge */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold uppercase tracking-wide text-foreground">
          {plan}
        </span>
        {plan === "free" && <UpgradeButton />}
        {plan === "pro" && stripePortalUrl && (
          <Link
            href={stripePortalUrl}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Manage Subscription
          </Link>
        )}
      </div>

      {/* Usage stats */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Usage this month</h2>

        <UsageStat
          label="Knowledge base documents"
          current={stats.documents}
          limit={limits.documents}
        />
        <UsageStat
          label="Conversations (this month)"
          current={stats.conversationsThisMonth}
          limit={limits.conversationsPerMonth}
        />
        <UsageStat label="Products" current={stats.products} limit={limits.products} />
        <UsageStat
          label="Tickets (this month)"
          current={stats.ticketsThisMonth}
          limit={limits.ticketsPerMonth}
        />
      </div>

      {/* Enabled tools */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">AI Tools</h2>
        <ul className="space-y-2">
          {[
            { key: "searchKnowledgeBase", label: "Knowledge Base Search" },
            { key: "getOrderStatus", label: "Order Status Lookup" },
            { key: "checkInventory", label: "Inventory Check" },
            { key: "createTicket", label: "Ticket Creation" },
          ].map(({ key, label }) => {
            const enabled = limits.enabledTools.includes(key);
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    enabled ? "bg-green-500" : "bg-zinc-300"
                  }`}
                  aria-hidden="true"
                />
                <span className={enabled ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
                {!enabled && (
                  <span className="ml-auto text-xs text-muted-foreground">Pro only</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
