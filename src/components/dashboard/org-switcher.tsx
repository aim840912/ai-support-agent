"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, Building2, Plus, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrgItem {
  id: string;
  name: string;
  plan: string;
  role: string;
  isActive: boolean;
}

interface OrgSwitcherProps {
  /** The current org name passed from the server (avoids a flash before fetch completes) */
  currentOrgName?: string;
}

export function OrgSwitcher({ currentOrgName }: OrgSwitcherProps) {
  const router = useRouter();
  const { data: _session, update: updateSession } = useSession();

  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null); // orgId being switched to

  // Create-org dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const data: OrgItem[] = await res.json();
      setOrgs(data);
    } catch {
      // Silently ignore — the user still sees the current org name from props
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const activeOrg = orgs.find((o) => o.isActive);
  const displayName = activeOrg?.name ?? currentOrgName ?? "Organization";

  async function handleSwitch(orgId: string) {
    if (switching) return; // Prevent double-click

    setSwitching(orgId);
    try {
      const res = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!res.ok) return;

      // Trigger an immediate JWT token refresh via NextAuth's update mechanism.
      // This causes the jwt callback to run with trigger === "update" and the
      // new orgId, rotating the session cookie without waiting for the 24h refresh.
      await updateSession({ activeOrgId: orgId });

      // Re-render all server components with the new session context.
      router.refresh();

      // Optimistically update local state
      setOrgs((prev) => prev.map((o) => ({ ...o, isActive: o.id === orgId })));
    } catch {
      // Switch failed — state remains unchanged
    } finally {
      setSwitching(null);
    }
  }

  async function handleCreateOrg() {
    setNewOrgName("");
    setCreateError(null);
    setCreateDialogOpen(true);
  }

  async function handleCreateOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = newOrgName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setCreateError(body.error ?? "Failed to create organization");
        return;
      }

      const newOrg: OrgItem = await res.json();

      // Rotate the JWT token immediately so session.user.orgId reflects the
      // new org without waiting for the 24 h refresh cycle.
      await updateSession({ activeOrgId: newOrg.id });

      // Re-render server components with the updated session.
      router.refresh();

      // Update local state: add new org, mark all others inactive.
      setOrgs((prev) => [
        ...prev.map((o) => ({ ...o, isActive: false })),
        { ...newOrg, isActive: true },
      ]);

      setCreateDialogOpen(false);
    } catch {
      setCreateError("An unexpected error occurred. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrgSubmit}>
            <div className="py-4">
              <Label htmlFor="new-org-name" className="mb-2 block text-sm font-medium">
                Organization name
              </Label>
              <Input
                id="new-org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="My Company"
                maxLength={100}
                autoFocus
                disabled={creating}
              />
              {createError && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {createError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newOrgName.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Switch organization"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
              <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            </div>
            <span className="truncate text-left">{displayName}</span>
            {loading ? (
              <Loader2
                className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Organizations
          </DropdownMenuLabel>

          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => !org.isActive && handleSwitch(org.id)}
              disabled={switching === org.id}
              className="flex cursor-pointer items-center gap-2"
            >
              {switching === org.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : org.isActive ? (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <div className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{org.name}</span>
                <span className="truncate text-xs capitalize text-muted-foreground">
                  {org.role} · {org.plan}
                </span>
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={handleCreateOrg}
            className="flex cursor-pointer items-center gap-2 text-muted-foreground"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm">Create new organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
