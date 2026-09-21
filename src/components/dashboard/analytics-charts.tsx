"use client";

import { Bar, BarChart, XAxis, YAxis, Tooltip, Area, AreaChart } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type DailyData = { date: string; count: number };
type SourceData = { source: string; count: number };
type ToolData = { tool: string; count: number };

const chartConfig = {
  count: { label: "Count", color: "var(--chart-1)" },
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ConversationsChart({ data }: { data: DailyData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No data yet" />;
  }

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <AreaChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)} // MM-DD
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.1}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function SourceDistribution({ data }: { data: SourceData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No data yet" />;
  }

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={80} />
        <Tooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--chart-2)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function ToolUsageChart({ data }: { data: ToolData[] }) {
  if (data.length === 0) {
    return <EmptyState message="No tool calls recorded yet" />;
  }

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="tool" tick={{ fontSize: 11 }} width={130} />
        <Tooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--chart-3)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
