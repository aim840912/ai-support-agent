"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WidgetIntegrationProps {
  apiKey: string;
  appUrl: string;
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function WidgetIntegration({ apiKey, appUrl }: WidgetIntegrationProps) {
  const widgetUrl = `${appUrl}/widget/${apiKey}`;

  const iframeCode = `<!-- AI Support Agent Widget -->
<iframe
  src="${widgetUrl}"
  width="400"
  height="600"
  style="
    border: none;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
  "
  title="AI Support Chat"
></iframe>`;

  const curlExample = `# Check widget is live
curl -s "${appUrl}/api/widget/chat" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello", "apiKey": "${apiKey}", "sessionId": "test-123"}'`;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-foreground">Widget Integration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Embed your AI support agent on any website with a single snippet. The widget is
          authenticated via your API key and all conversations are isolated to your organization.
        </p>
      </div>

      {/* API Key display */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Your API Key</h3>
        </div>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground truncate">
            {apiKey}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(apiKey)}
            className="shrink-0"
            aria-label="Copy API key"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Keep this key private. It authenticates all widget conversations with your organization.
          Rotate it in the Organization tab if compromised.
        </p>
      </div>

      {/* Embed snippet */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Embed Snippet</h3>
        <p className="text-sm text-muted-foreground">
          Add this to the <code className="text-xs bg-muted px-1 py-0.5 rounded">{`<body>`}</code>{" "}
          of any webpage. The widget floats in the bottom-right corner.
        </p>
        <CodeBlock code={iframeCode} label="HTML" />
      </div>

      {/* Preview link */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Preview Widget</h3>
        <p className="text-sm text-muted-foreground">
          Open the widget in a new tab to test it before embedding.
        </p>
        <a
          href={widgetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          Open Widget Preview
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* API usage */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">API Usage</h3>
        <p className="text-sm text-muted-foreground">
          You can also call the chat API directly from your backend or test with curl:
        </p>
        <CodeBlock code={curlExample} label="cURL" />

        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
          <p className="text-xs font-medium text-foreground">Chat API Reference</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>
              <span className="font-mono text-foreground">POST /api/widget/chat</span>
              {" — "}Send a message and receive a streaming AI response
            </li>
            <li>
              <span className="font-mono text-foreground">Body</span>
              {": "}
              <code className="font-mono">{"{ message, apiKey, sessionId }"}</code>
            </li>
            <li>
              <span className="font-mono text-foreground">Response</span>
              {": "}text/event-stream (Server-Sent Events)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
