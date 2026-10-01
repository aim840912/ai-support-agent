"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { resendWebhookDelivery } from "@/app/(dashboard)/integrations/actions";

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
 *
 * Resend replays the stored event through the real delivery path; the result
 * shows up as a new row once the page revalidates.
 */
export function WebhookDeliveriesTable({ deliveries }: { deliveries: DeliveryView[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResend(id: string) {
    setResending(id);
    startTransition(async () => {
      try {
        const result = await resendWebhookDelivery(id);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not resend.");
      } finally {
        setResending(null);
      }
    });
  }

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
            <th className="py-1">
              <span className="sr-only">Actions</span>
            </th>
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
                <td className="py-1.5 pl-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleResend(delivery.id)}
                    disabled={isPending}
                    aria-label={`Resend ${delivery.event} from ${formatTime(delivery.createdAt)}`}
                    className="inline-flex items-center gap-1 rounded px-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <RotateCw
                      className={`h-3 w-3 ${resending === delivery.id ? "animate-spin motion-reduce:animate-none" : ""}`}
                      aria-hidden="true"
                    />
                    Resend
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
