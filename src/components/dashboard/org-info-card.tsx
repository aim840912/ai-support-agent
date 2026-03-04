"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type OrgInfoCardProps = {
  orgName: string;
  plan: string;
  apiKey: string;
};

export function OrgInfoCard({ orgName, plan, apiKey }: OrgInfoCardProps) {
  const [copied, setCopied] = useState<"key" | "snippet" | null>(null);

  const embedSnippet = `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget/embed.js" data-api-key="${apiKey}"></script>`;

  async function copyToClipboard(text: string, type: "key" | "snippet") {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Org info */}
      <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">Organization</span>
          <span className="text-sm font-medium text-zinc-900">{orgName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">Plan</span>
          <Badge className="border-0 bg-zinc-100 text-xs font-medium capitalize text-zinc-700">
            {plan}
          </Badge>
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">API Key</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-600">
            {apiKey}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(apiKey, "key")}
            aria-label="Copy API key"
            className="shrink-0"
          >
            {copied === "key" ? (
              <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>
        <p className="text-xs text-zinc-400">
          Keep this key secret. Use it in the embed script or API calls.
        </p>
      </div>

      {/* Embed snippet */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">
          Widget Embed Code
        </label>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 font-mono text-xs text-zinc-600 whitespace-pre-wrap break-all">
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
        <p className="text-xs text-zinc-400">
          Paste this snippet before the <code>&lt;/body&gt;</code> tag on your website.
        </p>
      </div>
    </div>
  );
}
