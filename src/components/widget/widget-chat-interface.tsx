"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";

type WidgetChatInterfaceProps = {
  apiKey: string;
  welcomeMessage?: string;
  orgName?: string;
};

function makeWelcomeMessage(text: string): UIMessage {
  return {
    id: "welcome",
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

// Get or generate a stable visitor ID
function getVisitorId(): string {
  const key = "widget_visitor_id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    // crypto.randomUUID() is cryptographically secure (CSPRNG).
    // Math.random() is not — it's predictable and could allow session fixation.
    const id = `visitor_${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `visitor_${Date.now()}`;
  }
}

export function WidgetChatInterface({
  apiKey,
  welcomeMessage = "Hi! How can I help you today?",
  orgName = "Support",
}: WidgetChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visitorId] = useState(() => getVisitorId());

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/widget/chat",
      headers: { "x-api-key": apiKey },
      body: { visitorId },
    }),
    messages: [makeWelcomeMessage(welcomeMessage)],
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  function handleSubmit() {
    if (!input.trim() || isLoading) return;
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input }],
    });
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 bg-zinc-900">
        <div className="h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
        <span className="text-sm font-medium text-white">{orgName}</span>
      </div>

      {/* Messages */}
      <ScrollArea
        className="flex-1 min-h-0 px-3 py-3 scrollbar-hidden"
        ref={scrollRef as React.Ref<HTMLDivElement>}
      >
        <div className="space-y-3">
          {messages.map((message) => {
            const textContent =
              message.parts
                ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
                .map((p) => p.text)
                .join("") ?? "";

            return (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-zinc-900 text-white rounded-br-sm"
                      : "bg-zinc-100 text-zinc-900 rounded-bl-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{textContent}</p>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-3 py-2">
                <span className="flex gap-1" aria-label="Typing">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Something went wrong. Please try again.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-zinc-200 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
            disabled={isLoading}
            aria-label="Chat input"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
