import type { UIMessage } from "ai";
import { ToolCallDisplay } from "./tool-call-display";

type MessageBubbleProps = {
  message: UIMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-zinc-900 text-white rounded-br-sm"
            : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm"
        }`}
      >
        {/* Render each part of the message */}
        {message.parts.map((part, i) => {
          // Skip step-start dividers
          if (part.type === "step-start") return null;

          // Text content
          if (part.type === "text") {
            return (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }

          // Tool calls — type is 'tool-{name}' or 'dynamic-tool'
          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            const toolPart = part as {
              type: string;
              toolName?: string;
              toolCallId: string;
              state: string;
              input?: unknown;
              output?: unknown;
              errorText?: string;
            };
            return (
              <div key={i} className="mt-2 first:mt-0">
                <ToolCallDisplay part={toolPart} />
              </div>
            );
          }

          // Ignore other part types (reasoning, file, data-*, etc.)
          return null;
        })}
      </div>
    </div>
  );
}
