"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ConversationDetail } from "./conversation-detail";

type ChatSession = {
  id: string;
  source: string;
  visitorId: string | null;
  userId: string | null;
  createdAt: string;
  messageCount: number;
  firstMessage: string | null;
};

const sourceConfig: Record<string, { label: string; className: string }> = {
  widget: { label: "Widget", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  dashboard: { label: "Dashboard", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  api: { label: "API", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
};

export function ConversationList({ sessions }: { sessions: ChatSession[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Conversations will appear here once customers start chatting.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs font-medium text-muted-foreground">Source</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">First message</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right">Messages</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const source =
                sourceConfig[session.source] ?? {
                  label: session.source,
                  className: "bg-muted text-foreground",
                };
              return (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => setSelectedId(session.id)}
                >
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-0 text-xs font-medium",
                        source.className
                      )}
                    >
                      {source.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-sm text-foreground">
                      {session.firstMessage ?? (
                        <span className="italic text-muted-foreground">No messages</span>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {session.messageCount}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground/70">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConversationDetail
        sessionId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
