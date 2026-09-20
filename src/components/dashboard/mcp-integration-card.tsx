"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Plus, KeyRound, ShieldOff, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { createIntegrationKey, revokeIntegrationKey } from "@/app/(dashboard)/integrations/actions";

export type IntegrationKeyView = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type PlanToolView = {
  name: string;
  title: string;
  description: string;
  mutates: boolean;
};

type Props = {
  serverUrl: string;
  keys: IntegrationKeyView[];
  /** What this organization's plan actually exposes — the gating, made visible. */
  tools: PlanToolView[];
  plan: string;
  /** Only owners may issue machine credentials. */
  canIssueKeys: boolean;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </Button>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function McpIntegrationCard({ serverUrl, keys, tools, plan, canIssueKeys }: Props) {
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        "ai-support-agent": {
          url: serverUrl,
          headers: { Authorization: `Bearer ${freshKey ?? "<YOUR_KEY>"}` },
        },
      },
    },
    null,
    2
  );

  function handleCreate() {
    startTransition(async () => {
      const result = await createIntegrationKey({ name: name.trim() });
      if (result.ok && result.key) {
        setFreshKey(result.key);
        setName("");
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeIntegrationKey(id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">MCP server</h3>
        <p className="max-w-2xl text-xs text-muted-foreground">
          Let an AI client — Claude Desktop, an editor, your own agent — query your orders,
          inventory and knowledge base directly, using the same tools the support agent uses.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <Label>Server URL</Label>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
            {serverUrl}
          </code>
          <CopyButton value={serverUrl} label="Copy server URL" />
        </div>
      </div>

      {/* The plan gating is invisible unless it is shown: a free-plan client
          simply never sees the other two tools. */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">Available on your plan</h4>
          <Badge variant="secondary" className="uppercase">
            {plan}
          </Badge>
        </div>
        <ul className="space-y-2">
          {tools.map((tool) => (
            <li key={tool.name} className="flex flex-wrap items-baseline gap-2">
              <code className="text-xs">{tool.name}</code>
              <span className="text-xs text-muted-foreground">{tool.title}</span>
              {tool.mutates && (
                <Badge variant="outline" className="text-[11px]">
                  writes data
                </Badge>
              )}
            </li>
          ))}
        </ul>
        {plan === "free" && (
          <p className="text-xs text-muted-foreground">
            Pro adds <code>checkInventory</code> and <code>createTicket</code>. A client connected
            with a free-plan key does not see them at all.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground">Keys</h4>
          {!canIssueKeys && (
            <span className="text-xs text-muted-foreground">Only the owner can issue keys.</span>
          )}
        </div>

        {freshKey && (
          <div className="space-y-2 rounded-md border border-primary/50 bg-primary/5 p-3">
            <p className="flex items-start gap-2 text-xs font-medium text-foreground">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Copy this now. Only a hash is stored, so it cannot be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                {freshKey}
              </code>
              <CopyButton value={freshKey} label="Copy new key" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFreshKey(null)}>
              Done
            </Button>
          </div>
        )}

        {canIssueKeys && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                name="integrationKeyName"
                autoComplete="off"
                placeholder="Claude Desktop — laptop"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <Button size="sm" onClick={handleCreate} disabled={isPending || !name.trim()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create key
            </Button>
          </div>
        )}

        {activeKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active keys.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-medium">Name</th>
                  <th className="py-1 font-medium">Key</th>
                  <th className="py-1 font-medium">Created</th>
                  <th className="py-1 font-medium">Last used</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {activeKeys.map((key) => (
                  <tr key={key.id} className="border-t border-border">
                    <td className="py-2">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        {key.name}
                      </span>
                    </td>
                    <td className="py-2">
                      <code className="text-[11px]">{key.keyPrefix}…</code>
                    </td>
                    <td className="py-2 text-muted-foreground">{formatDate(key.createdAt)}</td>
                    <td className="py-2 text-muted-foreground">{formatDate(key.lastUsedAt)}</td>
                    <td className="py-2 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canIssueKeys || isPending}
                            aria-label={`Revoke ${key.name}`}
                          >
                            <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke “{key.name}”?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Any client using this key stops working immediately. Other keys are
                              unaffected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRevoke(key.id)}>
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground">Client configuration</h4>
          <CopyButton value={configSnippet} label="Copy client configuration" />
        </div>
        <p className="text-xs text-muted-foreground">
          For Claude Desktop, add this to <code>claude_desktop_config.json</code>. Other MCP clients
          take the same URL and header.
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-[11px]">{configSnippet}</pre>
      </div>
    </div>
  );
}
