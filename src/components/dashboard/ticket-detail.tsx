"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TicketNote = {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
};

type TicketDetailData = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  createdAt: string;
  updatedAt: string;
  notes: TicketNote[];
};

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

type Props = {
  ticketId: string | null;
  onClose: () => void;
  onUpdate: () => void;
};

export function TicketDetail({ ticketId, onClose, onUpdate }: Props) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      onClose();
      setTicket(null);
      setNoteText("");
      return;
    }
    if (ticketId && open) {
      setLoading(true);
      try {
        const res = await fetch(`/api/tickets/${ticketId}`);
        if (!res.ok) throw new Error("Failed to load ticket");
        const data = await res.json();
        setTicket(data);
      } catch {
        toast.error("Failed to load ticket details.");
        onClose();
      } finally {
        setLoading(false);
      }
    }
  };

  function handleStatusChange(newStatus: string) {
    if (!ticket) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Update failed");
        setTicket((prev) => prev ? { ...prev, status: newStatus } : prev);
        toast.success("Status updated");
        onUpdate();
      } catch {
        toast.error("Failed to update status.");
      }
    });
  }

  function handleAddNote() {
    if (!ticket || !noteText.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: noteText.trim() }),
        });
        if (!res.ok) throw new Error("Failed to add note");
        const updated = await fetch(`/api/tickets/${ticket.id}`);
        const data = await updated.json();
        setTicket(data);
        setNoteText("");
        toast.success("Note added");
        onUpdate();
      } catch {
        toast.error("Failed to add note.");
      }
    });
  }

  const status = ticket ? (statusConfig[ticket.status] ?? { label: ticket.status, className: "bg-muted text-foreground" }) : null;
  const priority = ticket ? (priorityConfig[ticket.priority] ?? { label: ticket.priority, className: "bg-muted text-foreground" }) : null;

  return (
    <Dialog open={!!ticketId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {ticket ? `${ticket.ticketNumber} — ${ticket.subject}` : "Ticket Details"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : ticket ? (
          <div className="space-y-5">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2">
              {status && (
                <Badge className={cn("border-0 text-xs font-medium", status.className)}>
                  {status.label}
                </Badge>
              )}
              {priority && (
                <Badge className={cn("border-0 text-xs font-medium", priority.className)}>
                  {priority.label}
                </Badge>
              )}
              {ticket.orderNumber && (
                <span className="text-xs text-muted-foreground">
                  Order: <span className="font-mono">{ticket.orderNumber}</span>
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Description */}
            <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
              {ticket.description}
            </div>

            {/* Status update */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Update status:</span>
              <Select
                value={ticket.status}
                onValueChange={handleStatusChange}
                disabled={isPending}
              >
                <SelectTrigger className="w-40" aria-label="Update ticket status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            {ticket.notes.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Internal notes</p>
                <ScrollArea className="h-40">
                  <div className="space-y-2 pr-2">
                    {ticket.notes.map((note) => (
                      <div key={note.id} className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Add note */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Add internal note</p>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Internal note visible only to your team..."
                className="resize-none"
                rows={3}
                maxLength={2000}
                aria-label="Internal note"
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteText.trim() || isPending}
              >
                Add Note
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
