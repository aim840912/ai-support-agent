"use client";

import { useState } from "react";
import { logError } from "@/lib/error-logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
};

const PRO_FEATURES = [
  "100 knowledge base documents",
  "Unlimited conversations",
  "Unlimited messages per conversation",
  "1,000 products in inventory",
  "Unlimited support tickets",
  "All 4 AI tools (KB, Orders, Inventory, Tickets)",
];

export function UpgradeDialog({ open, onOpenChange, reason }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpgrade() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start checkout");
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      logError("[upgrade-dialog] checkout error:", err);
      // Keep dialog open so user can try again
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>
            {reason ?? "You've reached a limit on the Free plan."}
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-2 space-y-2">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
              <Check className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleUpgrade}
          >
            {isLoading ? "Redirecting to checkout…" : "Upgrade to Pro"}
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
