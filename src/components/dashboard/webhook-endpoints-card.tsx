"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Send,
  Plus,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  WebhookDeliveriesTable,
  type DeliveryView,
} from "@/components/dashboard/webhook-deliveries-table";
import {
  createWebhookEndpoint,
  setWebhookEndpointEnabled,
  deleteWebhookEndpoint,
  rotateWebhookSecret,
  sendTestWebhook,
} from "@/app/(dashboard)/integrations/actions";

export type EndpointView = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  secret: string;
  lastStatus: number | null;
  lastFiredAt: string | null;
  failureCount: number;
  deliveries: DeliveryView[];
};

type Props = {
  endpoints: EndpointView[];
  canEdit: boolean;
  /** Headers the receiver will see, rendered in the setup hint. */
  headerNames: { id: string; event: string; timestamp: string; signature: string };
  failureThreshold: number;
};

function SecretRow({
  secret,
  onRotate,
  canEdit,
}: {
  secret: string;
  onRotate: () => void;
  canEdit: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
        {revealed ? secret : `${secret.slice(0, 10)}${"•".repeat(16)}`}
      </code>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide signing secret" : "Reveal signing secret"}
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy signing secret">
        {copied ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={!canEdit} aria-label="Rotate signing secret">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate this signing secret?</AlertDialogTitle>
            <AlertDialogDescription>
              Deliveries will fail signature verification until you paste the new secret into the
              receiving tool. There is no overlap period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRotate}>Rotate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function WebhookEndpointsCard({ endpoints, canEdit, headerNames, failureThreshold }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [testing, setTesting] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createWebhookEndpoint({
        url: url.trim(),
        events: ["ticket.created"],
        description: description.trim() || undefined,
      });
      if (result.ok) {
        setUrl("");
        setDescription("");
        setShowForm(false);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleTest(id: string) {
    setTesting(id);
    startTransition(async () => {
      const result = await sendTestWebhook(id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      setTesting(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">Outbound webhooks</h3>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Send an HTTP request to your own tools whenever the agent creates a support ticket — to
            post it in Slack, open a row in a spreadsheet, or start a workflow in n8n or Zapier.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={!canEdit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add endpoint
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint-url">Endpoint URL</Label>
            <Input
              id="endpoint-url"
              name="endpointUrl"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://your-tool.example/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endpoint-description">Label (optional)</Label>
            <Input
              id="endpoint-description"
              name="endpointDescription"
              autoComplete="off"
              placeholder="n8n — ticket to Slack"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Subscribed to <code>ticket.created</code>. More events will appear here as they are
            added.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isPending || !url.trim()}>
              Add endpoint
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {endpoints.length === 0 && !showForm && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No endpoints yet.
        </p>
      )}

      {endpoints.map((endpoint) => (
        <div key={endpoint.id} className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">{endpoint.url}</p>
              <div className="flex flex-wrap items-center gap-2">
                {endpoint.events.map((event) => (
                  <Badge key={event} variant="outline" className="font-mono text-[11px]">
                    {event}
                  </Badge>
                ))}
                {endpoint.description && (
                  <span className="text-xs text-muted-foreground">{endpoint.description}</span>
                )}
              </div>
            </div>
            <Switch
              checked={endpoint.enabled}
              disabled={!canEdit || isPending}
              aria-label={`Enable ${endpoint.url}`}
              onCheckedChange={(next) => run(() => setWebhookEndpointEnabled(endpoint.id, next))}
            />
          </div>

          {!endpoint.enabled && endpoint.failureCount >= failureThreshold && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Disabled automatically after {endpoint.failureCount} consecutive failures. Fix the
                receiver, then switch it back on — the failure count resets when you do.
              </span>
            </p>
          )}

          <div className="space-y-2">
            <Label>Signing secret</Label>
            <SecretRow
              secret={endpoint.secret}
              canEdit={canEdit}
              onRotate={() => run(() => rotateWebhookSecret(endpoint.id))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTest(endpoint.id)}
              disabled={!canEdit || isPending}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {testing === endpoint.id ? "Sending…" : "Send test event"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!canEdit || isPending}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this endpoint?</AlertDialogTitle>
                  <AlertDialogDescription>
                    No further events will be sent to {endpoint.url}, and its delivery history is
                    deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run(() => deleteWebhookEndpoint(endpoint.id))}>
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Recent deliveries</p>
            <WebhookDeliveriesTable deliveries={endpoint.deliveries} />
          </div>
        </div>
      ))}

      <div className="space-y-2 rounded-lg border border-border p-4">
        <h4 className="text-sm font-medium text-foreground">Verifying a delivery</h4>
        <p className="text-xs text-muted-foreground">
          Every request carries these headers. Recompute the HMAC over{" "}
          <code>{"`${timestamp}.${rawBody}`"}</code> and compare it in constant time. The timestamp
          is inside the signed value, so a captured request cannot be replayed with a fresh one.
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            <code>{headerNames.id}</code> — unique per event. Deduplicate on this: it is what turns
            replay resistance into replay prevention.
          </li>
          <li>
            <code>{headerNames.event}</code> — e.g. <code>ticket.created</code>
          </li>
          <li>
            <code>{headerNames.timestamp}</code> — unix seconds
          </li>
          <li>
            <code>{headerNames.signature}</code> — <code>t=&lt;unix&gt;,v1=&lt;hex&gt;</code>
          </li>
        </ul>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-[11px]">
          {`const [t, v1] = header.split(",").map((p) => p.split("=")[1]);
const expected = crypto
  .createHmac("sha256", secret)
  .update(\`\${t}.\${rawBody}\`)
  .digest("hex");
const ok =
  Math.abs(Date.now() / 1000 - Number(t)) <= 300 &&
  crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));`}
        </pre>
      </div>
    </div>
  );
}
