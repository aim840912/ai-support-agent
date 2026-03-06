"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { UpgradeDialog } from "./upgrade-dialog";

// --- Upgrade button (used in PlanUsageSection) ---
export function UpgradeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        Upgrade to Pro
      </button>
      <UpgradeDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// --- Upgrade success toast (used in Settings page after Stripe redirect) ---
export function UpgradeSuccessToast() {
  useEffect(() => {
    toast.success("Welcome to Pro! Your plan has been upgraded.");
    window.history.replaceState({}, "", "/settings?tab=plan");
  }, []);
  return null;
}
