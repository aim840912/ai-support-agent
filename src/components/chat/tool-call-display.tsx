"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from "lucide-react";

type ToolPartLike = {
  type: string; // 'tool-getOrderStatus' | 'dynamic-tool' | ...
  toolName?: string; // present for dynamic-tool
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

// Human-readable labels per tool name
const TOOL_LABELS: Record<string, string> = {
  searchKnowledgeBase: "Searching knowledge base",
  getOrderStatus: "Checking order status",
  checkInventory: "Checking inventory",
  createTicket: "Creating support ticket",
};

function getToolName(part: ToolPartLike): string {
  // For static tools: type = 'tool-getOrderStatus' → 'getOrderStatus'
  // For dynamic tools: use part.toolName directly
  if (part.type === "dynamic-tool") return part.toolName ?? "unknown";
  return part.type.startsWith("tool-") ? part.type.slice(5) : part.type;
}

function getLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

type ToolCallDisplayProps = {
  part: ToolPartLike;
};

export function ToolCallDisplay({ part }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolName = getToolName(part);
  const label = getLabel(toolName);

  const isComplete = part.state === "output-available";
  const isError = part.state === "output-error";
  const isRunning = !isComplete && !isError;

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 text-sm overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${label} — ${isRunning ? "in progress" : isError ? "error" : "completed"}`}
      >
        {/* Status icon */}
        {isRunning ? (
          <Loader2
            className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0"
            aria-hidden="true"
          />
        ) : isError ? (
          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" aria-hidden="true" />
        )}

        <span className="flex-1 text-zinc-700 font-medium">{label}</span>

        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
        )}
      </button>

      {/* Expandable details */}
      {isExpanded && (
        <div className="border-t border-zinc-200 px-3 py-2 space-y-2">
          {part.input !== undefined && (
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1">Input</p>
              <pre className="text-xs text-zinc-700 whitespace-pre-wrap break-all bg-white rounded border border-zinc-100 p-2 overflow-auto max-h-40">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            </div>
          )}

          {isComplete && part.output !== undefined && (
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1">Output</p>
              <pre className="text-xs text-zinc-700 whitespace-pre-wrap break-all bg-white rounded border border-zinc-100 p-2 overflow-auto max-h-40">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          )}

          {isError && part.errorText && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1">Error</p>
              <p className="text-xs text-red-700 bg-red-50 rounded border border-red-100 p-2">
                {part.errorText}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
