"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { regenerateApiKey } from "@/app/(dashboard)/settings/actions";

type OrgInfoCardProps = {
  orgName: string;
  plan: string;
  apiKey: string;
};

export function OrgInfoCard({ orgName, plan, apiKey: initialApiKey }: OrgInfoCardProps) {
  const [copied, setCopied] = useState<"key" | "snippet" | null>(null);
  const [currentApiKey, setCurrentApiKey] = useState(initialApiKey);
  const [isPending, startTransition] = useTransition();

  const embedSnippet = `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget/embed.js" data-api-key="${currentApiKey}"></script>`;

  async function copyToClipboard(text: string, type: "key" | "snippet") {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleRegenerate() {
    startTransition(async () => {
      try {
        const result = await regenerateApiKey();
        setCurrentApiKey(result.apiKey);
        toast.success("API key regenerated. Update the embed code on your website.");
      } catch {
        toast.error("Failed to regenerate API key. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Org info */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Organization</span>
          <span className="text-sm font-medium text-foreground">{orgName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Plan</span>
          <Badge className="border-0 bg-muted text-xs font-medium capitalize text-foreground">
            {plan}
          </Badge>
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">API Key</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {currentApiKey}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(currentApiKey, "key")}
            aria-label="Copy API key"
            className="shrink-0"
          >
            {copied === "key" ? (
              <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Regenerate API key"
                className="shrink-0"
                disabled={isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will invalidate your current key immediately. Any website using the
                  old embed snippet will stop working until you update it with the new key.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRegenerate}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Regenerate Key
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="text-xs text-muted-foreground">
          Keep this key secret. Use it in the embed script or API calls.
        </p>
      </div>

      {/* Embed snippet */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Widget Embed Code
        </label>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
            {embedSnippet}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(embedSnippet, "snippet")}
            aria-label="Copy embed code"
            className="absolute right-2 top-2 shrink-0"
          >
            {copied === "snippet" ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                <span className="ml-1 text-xs text-green-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="ml-1 text-xs">Copy</span>
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste this snippet before the <code>&lt;/body&gt;</code> tag on your website.
        </p>
      </div>
    </div>
  );
}
