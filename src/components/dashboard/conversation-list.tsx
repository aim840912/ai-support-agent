"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConversationDetail } from "./conversation-detail";
import { ExportButton } from "./export-button";
import { toast } from "sonner";

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
  widget: {
    label: "Widget",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  dashboard: {
    label: "Dashboard",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  api: {
    label: "API",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
};

type Props = {
  sessions: ChatSession[];
  activeSource?: string;
};

export function ConversationList({ sessions, activeSource }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSourceChange(value: string) {
    const params = new URLSearchParams();
    if (value !== "all") {
      params.set("source", value);
    }
    router.push(`/conversations?${params.toString()}`);
  }

  function handleDelete(sessionId: string) {
    setDeletingId(sessionId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/conversations/${sessionId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
        toast.success("Conversation deleted");
        router.refresh();
      } catch {
        toast.error("Failed to delete conversation. Please try again.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <>
      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by source:</span>
        <Select value={activeSource ?? "all"} onValueChange={handleSourceChange}>
          <SelectTrigger className="w-40" aria-label="Filter conversations by source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="widget">Widget</SelectItem>
            <SelectItem value="dashboard">Dashboard</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <ExportButton activeSource={activeSource} />
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {activeSource
              ? `No ${activeSource} conversations found.`
              : "Conversations will appear here once customers start chatting."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-medium text-muted-foreground">Source</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  First message
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Messages
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Date
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const source = sourceConfig[session.source] ?? {
                  label: session.source,
                  className: "bg-muted text-foreground",
                };
                const isDeleting = deletingId === session.id && isPending;

                return (
                  <TableRow
                    key={session.id}
                    className={cn(
                      "group cursor-pointer hover:bg-accent",
                      isDeleting && "opacity-50"
                    )}
                    onClick={() => setSelectedId(session.id)}
                  >
                    <TableCell>
                      <Badge className={cn("border-0 text-xs font-medium", source.className)}>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete conversation"
                            disabled={isDeleting}
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the conversation and all its messages.
                              Analytics counts will be updated. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(session.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConversationDetail sessionId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
