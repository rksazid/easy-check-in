"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PlatformUserTableProps = {
  initialUsers: PlatformUserItem[];
  currentUserId: string;
};

export function PlatformUserTable({
  initialUsers,
  currentUserId,
}: PlatformUserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user" | "banned">("all");
  const [pending, startTransition] = useTransition();

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
      if (input === null) return;
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
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or username..."
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setRoleFilter("all")}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-all active:scale-[0.97] whitespace-nowrap cursor-pointer ${
              roleFilter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("admin")}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-all active:scale-[0.97] whitespace-nowrap cursor-pointer ${
              roleFilter === "admin"
                ? "bg-indigo-600 text-white dark:bg-indigo-700 shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Super Admins ({superAdminCount})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("user")}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-all active:scale-[0.97] whitespace-nowrap cursor-pointer ${
              roleFilter === "user"
                ? "bg-secondary text-secondary-foreground shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Standard ({regularCount})
          </button>
          {bannedCount > 0 ? (
            <button
              type="button"
              onClick={() => setRoleFilter("banned")}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all active:scale-[0.97] whitespace-nowrap cursor-pointer ${
                roleFilter === "banned"
                  ? "bg-destructive text-destructive-foreground shadow-xs"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              }`}
            >
              Suspended ({bannedCount})
            </button>
          ) : null}
        </div>
      </div>

      {/* Content: Mobile Cards or Desktop Table */}
      {filteredUsers.length === 0 ? (
        <div className="border border-dashed border-border/70 rounded-lg p-8 text-center space-y-2">
          <User className="size-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">No users found</p>
          <p className="text-xs text-muted-foreground">
            {search
              ? "No platform accounts matched your search terms."
              : "No accounts match this filter."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (< sm) */}
          <div className="grid gap-3 sm:hidden">
            {filteredUsers.map((u) => {
              const isSelf = u.id === currentUserId;

              return (
                <div
                  key={u.id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-3 transition-all touch-press"
                >
                  {/* Top: Avatar, Name, Email, Role Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar
                        name={u.name}
                        src={u.image}
                        className="size-9 text-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm truncate">
                            {u.name}
                          </p>
                          {isSelf ? (
                            <span className="text-[11px] text-muted-foreground font-normal">
                              (you)
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                        {u.username ? (
                          <p className="text-[11px] text-muted-foreground/80 truncate">
                            @{u.username}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {u.isSuperAdmin ? (
                        <Badge
                          variant="outline"
                          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 gap-1 font-medium text-[10px] py-0 px-1.5"
                        >
                          <ShieldCheck className="size-2.5 text-indigo-500" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] text-muted-foreground font-normal py-0 px-1.5"
                        >
                          User
                        </Badge>
                      )}

                      {u.banned ? (
                        <Badge
                          variant="destructive"
                          className="gap-1 text-[10px] py-0 px-1.5"
                        >
                          <Ban className="size-2.5" />
                          Suspended
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle className="size-2.5" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Organizations & Roles */}
                  <div className="space-y-1 text-xs border-t border-border/50 pt-2.5">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Organizations
                    </span>
                    {u.memberships.length === 0 ? (
                      <p className="text-muted-foreground/60 italic text-xs">
                        No organization memberships
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {u.memberships.map((m) => (
                          <span
                            key={m.organizationId}
                            className="inline-flex items-center gap-1 rounded border border-border/80 bg-background/60 px-2 py-0.5 text-[11px]"
                          >
                            <OrgIcon
                              logo={m.organizationLogo}
                              name={m.organizationName}
                              size="sm"
                              className="size-3.5 text-[9px]"
                            />
                            <span className="font-medium max-w-[130px] truncate">
                              {m.organizationName}
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              ({m.role})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer: Joined date & Action buttons */}
                  <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-xs">
                    <span className="text-muted-foreground text-[11px]">
                      Joined <LocalTime value={u.createdAt} format="date" />
                    </span>

                    {!isSelf ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={u.isSuperAdmin ? "outline" : "ghost"}
                          disabled={pending}
                          onClick={() =>
                            handleToggleSuperAdmin(
                              u.id,
                              u.name,
                              !u.isSuperAdmin,
                            )
                          }
                          className="h-7 px-2 text-[11px]"
                        >
                          {u.isSuperAdmin ? (
                            <>
                              <ShieldAlert className="size-3 mr-1 text-amber-500" />
                              Revoke
                            </>
                          ) : (
                            <>
                              <Shield className="size-3 mr-1 text-indigo-500" />
                              Super
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            handleToggleBan(u.id, u.name, Boolean(u.banned))
                          }
                          className={`h-7 px-2 text-[11px] ${
                            u.banned
                              ? "text-foreground hover:bg-muted"
                              : "text-destructive hover:bg-destructive/10"
                          }`}
                        >
                          {u.banned ? (
                            <>
                              <CheckCircle className="size-3 mr-1 text-emerald-500" />
                              Unban
                            </>
                          ) : (
                            <>
                              <UserX className="size-3 mr-1" />
                              Suspend
                            </>
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= sm) */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">User</TableHead>
                  <TableHead className="w-[140px]">Designation</TableHead>
                  <TableHead className="min-w-[220px]">
                    Organizations & Roles
                  </TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[110px]">Joined</TableHead>
                  <TableHead className="text-right min-w-[140px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId;

                  return (
                    <TableRow key={u.id}>
                      {/* User info */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={u.name}
                            src={u.image}
                            className="size-7 text-xs"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate">
                              {u.name}
                              {isSelf ? (
                                <span className="ml-1 text-[11px] text-muted-foreground font-normal">
                                  (you)
                                </span>
                              ) : null}
                            </p>
                            <p className="text-muted-foreground readout text-[11px] truncate">
                              {u.email}
                              {u.username ? ` • @${u.username}` : ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Designation / System Role */}
                      <TableCell>
                        {u.isSuperAdmin ? (
                          <Badge
                            variant="outline"
                            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 gap-1 font-medium text-[11px]"
                          >
                            <ShieldCheck className="size-3 text-indigo-500" />
                            Super Admin
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[11px] text-muted-foreground font-normal"
                          >
                            User
                          </Badge>
                        )}
                      </TableCell>

                      {/* Organizations & Member Roles */}
                      <TableCell>
                        {u.memberships.length === 0 ? (
                          <span className="text-muted-foreground/60 italic text-[11px]">
                            No organizations
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.memberships.map((m) => (
                              <span
                                key={m.organizationId}
                                className="inline-flex items-center gap-1 rounded border border-border/80 bg-background/60 px-1.5 py-0.5 text-[11px]"
                              >
                                <OrgIcon
                                  logo={m.organizationLogo}
                                  name={m.organizationName}
                                  size="sm"
                                  className="size-3.5 text-[9px]"
                                />
                                <span className="font-medium max-w-[100px] truncate">
                                  {m.organizationName}
                                </span>
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  ({m.role})
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {u.banned ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 text-[10px] py-0"
                          >
                            <Ban className="size-2.5" />
                            Suspended
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle className="size-3" />
                            Active
                          </span>
                        )}
                      </TableCell>

                      {/* Joined Date */}
                      <TableCell className="text-muted-foreground whitespace-nowrap text-[11px]">
                        <LocalTime value={u.createdAt} format="date" />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        {!isSelf && (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={u.isSuperAdmin ? "outline" : "ghost"}
                              disabled={pending}
                              onClick={() =>
                                handleToggleSuperAdmin(
                                  u.id,
                                  u.name,
                                  !u.isSuperAdmin,
                                )
                              }
                              className="h-7 px-2 text-[11px]"
                              title={
                                u.isSuperAdmin
                                  ? "Revoke Super Admin"
                                  : "Promote to Super Admin"
                              }
                            >
                              {u.isSuperAdmin ? (
                                <>
                                  <ShieldAlert className="size-3 mr-1 text-amber-500" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <Shield className="size-3 mr-1 text-indigo-500" />
                                  Admin
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() =>
                                handleToggleBan(
                                  u.id,
                                  u.name,
                                  Boolean(u.banned),
                                )
                              }
                              className={`h-7 px-2 text-[11px] ${
                                u.banned
                                  ? "text-foreground hover:bg-muted"
                                  : "text-destructive hover:bg-destructive/10"
                              }`}
                              title={
                                u.banned ? "Unban account" : "Suspend account"
                              }
                            >
                              {u.banned ? (
                                <>
                                  <CheckCircle className="size-3 mr-1 text-emerald-500" />
                                  Unban
                                </>
                              ) : (
                                <>
                                  <UserX className="size-3 mr-1" />
                                  Suspend
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

