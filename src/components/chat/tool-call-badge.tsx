"use client";

import { Search, PackageSearch, Boxes, TicketPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_METADATA } from "@/lib/ai/tool-metadata";

const TOOL_ICONS: Record<string, LucideIcon> = {
  searchKnowledgeBase: Search,
  getOrderStatus: PackageSearch,
  checkInventory: Boxes,
  createTicket: TicketPlus,
};

type ToolCall = { toolName: string };

type ToolCallBadgesProps = {
  toolCalls: ToolCall[];
};

export function ToolCallBadges({ toolCalls }: ToolCallBadgesProps) {
  if (!toolCalls.length) return null;

  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {toolCalls.map((tc, i) => {
        const meta = TOOL_METADATA[tc.toolName];
        const Icon = TOOL_ICONS[tc.toolName];
        const label = meta?.label ?? tc.toolName;
        const bgClass = meta?.bg ?? "bg-muted";
        const colorClass = meta?.color ?? "text-muted-foreground";

        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              bgClass,
              colorClass
            )}
          >
            {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
            {label}
          </span>
        );
      })}
    </div>
  );
}
