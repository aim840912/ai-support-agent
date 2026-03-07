"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Mail, Trash2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InviteMemberDialog } from "./invite-member-dialog";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  expires: string;
  sentAt: string;
};

type Props = {
  members: Member[];
  invitations: PendingInvitation[];
  currentUserId: string;
  currentUserRole: string;
  canInviteMore: boolean;
  planLimit: number;
};

const roleConfig: Record<string, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  admin: { label: "Admin", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  member: { label: "Member", className: "bg-muted text-muted-foreground" },
};

export function TeamMembers({
  members,
  invitations,
  currentUserId,
  currentUserRole,
  canInviteMore,
  planLimit,
}: Props) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = ["owner", "admin"].includes(currentUserRole);
  const isOwner = currentUserRole === "owner";

  function handleRemove(memberId: string) {
    setRemovingId(memberId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Remove failed");
        }
        toast.success("Member removed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove member.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  function handleRoleChange(memberId: string, newRole: "admin" | "member") {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/team/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Role change failed");
        }
        toast.success("Role updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update role.");
      }
    });
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {members.length} / {planLimit === -1 ? "unlimited" : planLimit} members
            </p>
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              disabled={!canInviteMore}
              aria-label="Invite team member"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Invite Member
            </Button>
          )}
        </div>

        {!canInviteMore && canManage && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            You&apos;ve reached the team member limit ({planLimit}). Upgrade to Pro for up to 20 members.
          </div>
        )}

        {/* Member list */}
        <div className="space-y-2">
          {members.map((member) => {
            const role = roleConfig[member.role] ?? { label: member.role, className: "bg-muted text-foreground" };
            const isSelf = member.id === currentUserId;
            const isRemoving = removingId === member.id && isPending;
            const canRemoveThis =
              canManage &&
              !isSelf &&
              member.role !== "owner" &&
              !(currentUserRole === "admin" && ["admin", "owner"].includes(member.role));
            const canChangeRole = isOwner && !isSelf && member.role !== "owner";

            return (
              <div
                key={member.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border border-border px-4 py-3",
                  isRemoving && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {member.name ?? member.email}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    {member.name && (
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canChangeRole ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={isPending}
                          aria-label={`Change role for ${member.name ?? member.email}`}
                        >
                          <span className={cn("rounded px-1.5 py-0.5 font-medium", role.className)}>
                            {role.label}
                          </span>
                          <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, "admin")}>
                          Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, "member")}>
                          Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge className={cn("border-0 text-xs font-medium", role.className)}>
                      {role.label}
                    </Badge>
                  )}

                  {canRemoveThis && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${member.name ?? member.email}`}
                          disabled={isRemoving}
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {member.name ?? member.email}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove them from your organization. They will lose access to all resources.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(member.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Pending Invitations</p>
            <div className="space-y-2">
              {invitations.map((inv) => {
                const role = roleConfig[inv.role] ?? { label: inv.role, className: "bg-muted text-foreground" };
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
                      <div>
                        <p className="text-sm text-foreground">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(inv.expires).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("border-0 text-xs font-medium", role.className)}>
                      {role.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <InviteMemberDialog
        open={inviteOpen}
        currentUserRole={currentUserRole}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => {
          setInviteOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
