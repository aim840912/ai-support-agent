"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { AlertCircle } from "lucide-react";
import type { UIMessage } from "ai";

type ChatInterfaceProps = {
  orgId: string;
  isLlmMock: boolean;
  welcomeMessage?: string;
};

// Initial welcome message — no `content` field in ai@6 UIMessage
function makeWelcomeMessage(text: string): UIMessage {
  return {
    id: "welcome",
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

export function ChatInterface({
  orgId: _orgId,
  isLlmMock,
  welcomeMessage = "Hi! I'm your AI support assistant. How can I help you today?",
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // ai@6: useChat uses ChatInit, api is set via transport
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [makeWelcomeMessage(welcomeMessage)],
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom when messages change
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
    // sendMessage takes CreateUIMessage — only parts needed for user message
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input }],
    });
    setInput("");
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Mock mode banner */}
      {isLlmMock && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Demo mode</strong> — Running with a mock LLM. Add{" "}
            <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">GROQ_API_KEY</code> to
            enable a real AI model.
          </span>
        </div>
      )}

      {/* Messages area */}
      <ScrollArea className="flex-1 min-h-0 px-4 py-4" ref={scrollRef as React.Ref<HTMLDivElement>}>
        <div className="max-w-2xl mx-auto">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <span className="flex gap-1" aria-label="AI is typing">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                </span>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex justify-center mb-3">
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Something went wrong.{" "}
                  <button
                    type="button"
                    className="underline hover:no-underline"
                    onClick={() => window.location.reload()}
                  >
                    Reload page
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        placeholder="Ask about your order, product availability..."
      />
    </div>
  );
}
