"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type DeliveryView = {
  id: string;
  event: string;
  status: string;
  statusCode: number | null;
  durationMs: number;
  attempt: number;
  error: string | null;
  responseBody: string | null;
  createdAt: string;
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Recent delivery attempts for one endpoint.
 *
 * Collapsed by default: the list matters when something is wrong, and an
 * expanded table of successes on every page load is noise. Rows expand to the
 * error and response body, which is the only way to debug a field-mapping
 * problem in the receiving tool.
 */
export function WebhookDeliveriesTable({ deliveries }: { deliveries: DeliveryView[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (deliveries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No deliveries yet. Use “Send test event” to try it.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="w-6 py-1" />
            <th className="py-1 font-medium">When</th>
            <th className="py-1 font-medium">Event</th>
            <th className="py-1 font-medium">Result</th>
            <th className="py-1 text-right font-medium tabular-nums">Time</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => {
            const isOpen = expanded === delivery.id;
            const detail = delivery.error ?? delivery.responseBody;
            return (
              <tr key={delivery.id} className="border-t border-border align-top">
                <td className="py-1.5">
                  {detail ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : delivery.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Hide details" : "Show details"}
                      className="rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                </td>
                <td className="py-1.5 whitespace-nowrap text-muted-foreground">
                  {formatTime(delivery.createdAt)}
                </td>
                <td className="py-1.5">
                  <code className="text-[11px]">{delivery.event}</code>
                  {delivery.attempt > 1 && (
                    <span className="ml-1 text-muted-foreground">·{delivery.attempt} tries</span>
                  )}
                  {isOpen && detail && (
                    <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted p-2 text-[11px] whitespace-pre-wrap">
                      {detail}
                    </pre>
                  )}
                </td>
                <td className="py-1.5">
                  <Badge variant={delivery.status === "success" ? "default" : "destructive"}>
                    {delivery.statusCode ?? "no response"}
                  </Badge>
                </td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                  {delivery.durationMs}ms
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
