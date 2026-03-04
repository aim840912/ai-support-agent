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
  widget: { label: "Widget", className: "bg-blue-100 text-blue-800" },
  dashboard: { label: "Dashboard", className: "bg-purple-100 text-purple-800" },
  api: { label: "API", className: "bg-orange-100 text-orange-800" },
};

export function ConversationList({ sessions }: { sessions: ChatSession[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16">
        <MessageSquare className="mb-3 h-8 w-8 text-zinc-300" aria-hidden="true" />
        <p className="text-sm font-medium text-zinc-500">No conversations yet</p>
        <p className="mt-1 text-xs text-zinc-400">
          Conversations will appear here once customers start chatting.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="text-xs font-medium text-zinc-500">Source</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500">First message</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 text-right">Messages</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const source =
                sourceConfig[session.source] ?? {
                  label: session.source,
                  className: "bg-zinc-100 text-zinc-800",
                };
              return (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-zinc-50"
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
                    <p className="truncate text-sm text-zinc-700">
                      {session.firstMessage ?? (
                        <span className="italic text-zinc-400">No messages</span>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="text-right text-sm text-zinc-500">
                    {session.messageCount}
                  </TableCell>
                  <TableCell className="text-right text-sm text-zinc-400">
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
