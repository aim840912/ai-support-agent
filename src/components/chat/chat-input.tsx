"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSubmit();
      }
    }
  }

  return (
    <div className="flex items-end gap-2 p-4 border-t border-zinc-200 bg-white">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none min-h-[40px] max-h-[160px] overflow-y-auto focus-visible:ring-1"
        aria-label="Chat message input"
        disabled={isLoading}
      />
      <Button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        size="icon"
        className="shrink-0 h-10 w-10"
        aria-label="Send message"
      >
        <SendHorizontal className="w-4 h-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
