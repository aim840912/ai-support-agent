"use client";

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

/**
 * Upgrade prompt dialog — shown when a user hits a plan limit.
 * CTA is a placeholder (no payment integration yet).
 */
export function UpgradeDialog({ open, onOpenChange, reason }: Props) {
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
            <li key={feature} className="flex items-center gap-2 text-sm text-zinc-700">
              <Check className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            onClick={() => {
              // TODO: integrate Stripe or billing portal
              alert("Billing not yet configured. Contact support to upgrade.");
            }}
          >
            Upgrade to Pro
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
