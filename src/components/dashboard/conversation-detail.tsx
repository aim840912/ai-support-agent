"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type ConversationDetailProps = {
  sessionId: string | null;
  onClose: () => void;
};

export function ConversationDetail({
  sessionId,
  onClose,
}: ConversationDetailProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch messages when dialog opens
  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      onClose();
      return;
    }
    if (sessionId && open) {
      setLoading(true);
      try {
        const res = await fetch(`/api/conversations/${sessionId}`);
        const data = await res.json();
        setMessages(data.messages ?? []);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Dialog open={!!sessionId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-900">Conversation History</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-zinc-400">Loading...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-zinc-400">No messages in this conversation.</p>
          </div>
        ) : (
          <ScrollArea className="h-[480px] pr-4">
            <div className="space-y-3 py-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-900"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        msg.role === "user" ? "text-zinc-400" : "text-zinc-400"
                      )}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
