"use client";

/**
 * Lazy-loaded chart wrappers.
 *
 * `next/dynamic` with `ssr: false` must live in a Client Component — it cannot
 * be used directly in a Server Component. This thin wrapper owns the dynamic
 * imports so that the analytics page (a Server Component) can still benefit
 * from deferred loading: stat cards render immediately from the server, and
 * charts are hydrated client-side after the initial paint.
 */
import dynamic from "next/dynamic";

function ChartSkeleton() {
  return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
}

export const ConversationsChart = dynamic(
  () =>
    import("@/components/dashboard/analytics-charts").then((m) => ({
      default: m.ConversationsChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const SourceDistribution = dynamic(
  () =>
    import("@/components/dashboard/analytics-charts").then((m) => ({
      default: m.SourceDistribution,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const ToolUsageChart = dynamic(
  () =>
    import("@/components/dashboard/analytics-charts").then((m) => ({
      default: m.ToolUsageChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
