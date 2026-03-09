"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TicketX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TicketDetail } from "./ticket-detail";

export type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: {
    label: "Medium",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

type Props = {
  tickets: Ticket[];
  activeStatus?: string;
  activePriority?: string;
};

export function TicketList({ tickets, activeStatus, activePriority }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleFilterChange(type: "status" | "priority", value: string) {
    const params = new URLSearchParams();
    if (type === "status" && value !== "all") params.set("status", value);
    else if (type !== "status" && activeStatus) params.set("status", activeStatus);

    if (type === "priority" && value !== "all") params.set("priority", value);
    else if (type !== "priority" && activePriority) params.set("priority", activePriority);

    startTransition(() => {
      router.push(`/tickets?${params.toString()}`);
    });
  }

  return (
    <>
      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select
          value={activeStatus ?? "all"}
          onValueChange={(v) => handleFilterChange("status", v)}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={activePriority ?? "all"}
          onValueChange={(v) => handleFilterChange("priority", v)}
        >
          <SelectTrigger className="w-40" aria-label="Filter by priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <TicketX className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">No tickets found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Tickets created by the AI agent will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Ticket #
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Subject</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Priority
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Order</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const status = statusConfig[ticket.status] ?? {
                  label: ticket.status,
                  className: "bg-muted text-foreground",
                };
                const priority = priorityConfig[ticket.priority] ?? {
                  label: ticket.priority,
                  className: "bg-muted text-foreground",
                };

                return (
                  <TableRow
                    key={ticket.id}
                    className={cn("cursor-pointer hover:bg-accent")}
                    onClick={() => setSelectedId(ticket.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {ticket.ticketNumber}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm text-foreground font-medium">
                        {ticket.subject}
                      </p>
                      {ticket.noteCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ticket.noteCount} note{ticket.noteCount !== 1 ? "s" : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-0 text-xs font-medium", priority.className)}>
                        {priority.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-0 text-xs font-medium", status.className)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ticket.orderNumber ?? (
                        <span className="italic text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground/70">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TicketDetail
        ticketId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdate={() => router.refresh()}
      />
    </>
  );
}
