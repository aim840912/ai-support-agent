"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { updateAgentSettings } from "@/app/(dashboard)/settings/actions";

// Keep in sync with tool-call-display.tsx TOOL_LABELS
const AVAILABLE_TOOLS: { key: string; label: string }[] = [
  { key: "searchKnowledgeBase", label: "Search Knowledge Base" },
  { key: "getOrderStatus", label: "Get Order Status" },
  { key: "checkInventory", label: "Check Inventory" },
  { key: "createTicket", label: "Create Support Ticket" },
];

type AgentSettingsFormProps = {
  welcomeMessage: string;
  systemPrompt: string | null;
  enabledTools: string[];
};

export function AgentSettingsForm({
  welcomeMessage: initialWelcome,
  systemPrompt: initialPrompt,
  enabledTools: initialTools,
}: AgentSettingsFormProps) {
  const [welcomeMessage, setWelcomeMessage] = useState(initialWelcome);
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt ?? "");
  const [enabledTools, setEnabledTools] = useState<Set<string>>(
    new Set(initialTools)
  );
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleTool(key: string) {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      await updateAgentSettings({
        welcomeMessage,
        systemPrompt,
        enabledTools: Array.from(enabledTools),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="space-y-2">
        <Label htmlFor="welcome-message" className="text-sm font-medium text-foreground">
          Welcome Message
        </Label>
        <Textarea
          id="welcome-message"
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          placeholder="Hi! How can I help you today?"
          rows={2}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          First message shown to visitors when they open the chat widget.
        </p>
      </div>

      {/* System prompt */}
      <div className="space-y-2">
        <Label htmlFor="system-prompt" className="text-sm font-medium text-foreground">
          System Prompt
        </Label>
        <Textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful customer support agent for..."
          rows={5}
          className="resize-none font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Custom instructions that guide the AI&apos;s behavior and tone.
        </p>
      </div>

      {/* Enabled tools */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Enabled Tools</Label>
        <div className="space-y-3 rounded-lg border border-border p-4">
          {AVAILABLE_TOOLS.map((tool) => (
            <div key={tool.key} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{tool.label}</span>
              <Switch
                id={`tool-${tool.key}`}
                checked={enabledTools.has(tool.key)}
                onCheckedChange={() => toggleTool(tool.key)}
                aria-label={`Toggle ${tool.label}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Choose which tools the agent can use when responding.
        </p>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/80"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
