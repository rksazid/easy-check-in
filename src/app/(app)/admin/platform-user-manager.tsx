"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Ban,
  Building2,
  CheckCircle,
  Crown,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserX,
} from "lucide-react";

import {
  PlatformUserItem,
  toggleSuperAdminRole,
  toggleUserBan,
} from "@/actions/users";
import { Avatar } from "@/components/avatar";
import { LocalTime } from "@/components/local-time";
import { OrgIcon } from "@/components/org-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PlatformUserManagerProps = {
  initialUsers: PlatformUserItem[];
  currentUserId: string;
};

export function PlatformUserManager({
  initialUsers,
  currentUserId,
}: PlatformUserManagerProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user" | "banned">("all");
  const [pending, startTransition] = useTransition();

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q));

      let matchesRole = true;
      if (roleFilter === "admin") {
        matchesRole = u.isSuperAdmin;
      } else if (roleFilter === "user") {
        matchesRole = !u.isSuperAdmin && !u.banned;
      } else if (roleFilter === "banned") {
        matchesRole = Boolean(u.banned);
      }

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  // Counts
  const superAdminCount = useMemo(
    () => users.filter((u) => u.isSuperAdmin).length,
    [users],
  );
  const regularCount = useMemo(
    () => users.filter((u) => !u.isSuperAdmin && !u.banned).length,
    [users],
  );
  const bannedCount = useMemo(
    () => users.filter((u) => u.banned).length,
    [users],
  );

  function handleToggleSuperAdmin(userId: string, targetName: string, makeAdmin: boolean) {
    if (userId === currentUserId && !makeAdmin) {
      toast.error("You cannot revoke your own Super Admin access.");
      return;
    }

    const actionText = makeAdmin ? "promote to Super Admin" : "revoke Super Admin privileges for";
    if (!confirm(`Are you sure you want to ${actionText} ${targetName}?`)) {
      return;
    }

    startTransition(async () => {
      const res = await toggleSuperAdminRole(userId, makeAdmin);
      if (res.ok) {
        toast.success(
          makeAdmin
            ? `${targetName} is now a Super Admin`
            : `Revoked Super Admin from ${targetName}`,
        );
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  role: makeAdmin ? "admin" : "user",
                  isSuperAdmin: makeAdmin,
                }
              : u,
          ),
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleToggleBan(userId: string, targetName: string, currentlyBanned: boolean) {
    if (userId === currentUserId) {
      toast.error("You cannot ban yourself.");
      return;
    }

    let reason: string | undefined = undefined;
    if (!currentlyBanned) {
      const input = prompt(
        `Enter suspension reason for ${targetName} (optional):`,
        "Suspended by Platform Administrator",
      );
      if (input === null) return; // user cancelled
      reason = input.trim() || undefined;
    } else {
      if (!confirm(`Unban and restore access for ${targetName}?`)) {
        return;
      }
    }

    startTransition(async () => {
      const res = await toggleUserBan(userId, !currentlyBanned, reason);
      if (res.ok) {
        toast.success(
          currentlyBanned
            ? `${targetName} was unbanned`
            : `${targetName} was suspended`,
        );
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  banned: !currentlyBanned,
                  banReason: !currentlyBanned ? (reason ?? "Suspended") : null,
                }
              : u,
          ),
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search platform users by name, email, or username..."
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setRoleFilter("all")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              roleFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            All ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("admin")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              roleFilter === "admin"
                ? "bg-indigo-600 text-white dark:bg-indigo-700"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Super Admins ({superAdminCount})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("user")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              roleFilter === "user"
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Standard ({regularCount})
          </button>
          {bannedCount > 0 ? (
            <button
              type="button"
              onClick={() => setRoleFilter("banned")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                roleFilter === "banned"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              }`}
            >
              Suspended ({bannedCount})
            </button>
          ) : null}
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="border border-dashed border-border/70 rounded-lg p-8 text-center space-y-2">
          <User className="size-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">No users found</p>
          <p className="text-xs text-muted-foreground">
            {search ? "No platform accounts matched your search terms." : "No accounts match this filter."}
          </p>
        </div>
      ) : (
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {filteredUsers.map((u) => {
            const isSelf = u.id === currentUserId;

            return (
              <li
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 transition-colors hover:bg-muted/20"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Avatar name={u.name} src={u.image} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">
                        {u.name}
                        {isSelf ? (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                            (you)
                          </span>
                        ) : null}
                      </p>

                      {u.isSuperAdmin ? (
                        <Badge
                          variant="outline"
                          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 gap-1 font-medium text-xs"
                        >
                          <ShieldCheck className="size-3 text-indigo-500" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs text-muted-foreground">
                          User
                        </Badge>
                      )}

                      {u.banned ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <Ban className="size-3" />
                          Suspended
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="size-3" />
                          Active
                        </span>
                      )}
                    </div>

                    <p className="text-muted-foreground readout text-xs truncate">
                      {u.email}
                      {u.username ? ` • @${u.username}` : ""} • Joined{" "}
                      <LocalTime value={u.createdAt} format="date" />
                    </p>

                    {u.banned && u.banReason ? (
                      <p className="text-xs text-destructive border-l-2 border-destructive/50 pl-2 py-0.5">
                        Reason: {u.banReason}
                      </p>
                    ) : null}

                    {/* Organizations memberships */}
                    <div className="pt-1">
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">
                        Organizations ({u.memberships.length}):
                      </p>
                      {u.memberships.length === 0 ? (
                        <span className="text-xs text-muted-foreground/70 italic">
                          None
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {u.memberships.map((m) => (
                            <span
                              key={m.organizationId}
                              className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background/80 px-2 py-0.5 text-xs"
                            >
                              <OrgIcon logo={m.organizationLogo} name={m.organizationName} size="sm" />
                              <span className="font-medium">{m.organizationName}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">
                                ({m.role})
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Super Admin Control Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-1">
                  {!isSelf && (
                    <Button
                      size="sm"
                      variant={u.isSuperAdmin ? "outline" : "default"}
                      disabled={pending}
                      onClick={() => handleToggleSuperAdmin(u.id, u.name, !u.isSuperAdmin)}
                      className="text-xs h-8"
                    >
                      {u.isSuperAdmin ? (
                        <>
                          <ShieldAlert className="size-3.5 mr-1 text-amber-500" />
                          Revoke Super Admin
                        </>
                      ) : (
                        <>
                          <Shield className="size-3.5 mr-1" />
                          Make Super Admin
                        </>
                      )}
                    </Button>
                  )}

                  {!isSelf && (
                    <Button
                      size="sm"
                      variant={u.banned ? "outline" : "ghost"}
                      disabled={pending}
                      onClick={() => handleToggleBan(u.id, u.name, Boolean(u.banned))}
                      className={`text-xs h-8 ${
                        u.banned
                          ? "text-foreground"
                          : "text-destructive hover:bg-destructive/10"
                      }`}
                    >
                      {u.banned ? (
                        <>
                          <CheckCircle className="size-3.5 mr-1 text-emerald-500" />
                          Unban Account
                        </>
                      ) : (
                        <>
                          <UserX className="size-3.5 mr-1" />
                          Suspend Account
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
