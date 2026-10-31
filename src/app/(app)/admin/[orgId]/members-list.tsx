"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { Input } from "@/components/ui/input";
import { MemberActions } from "./member-actions";
import { MemberRoleChanger } from "./member-role-changer";
import { MemberTagPicker } from "./member-tag-picker";

type Tag = { id: string; name: string; color?: string | null };

type MemberItem = {
  memberId: string;
  role: string;
  joinedAt: Date;
  userId: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
};

type MembersListProps = {
  organizationId: string;
  currentUserId: string;
  currentUserRole: string;
  isSuperAdmin: boolean;
  members: MemberItem[];
  orgTags: Tag[];
  memberTagMap: Record<string, Tag[]>;
};

export function MembersList({
  organizationId,
  currentUserId,
  currentUserRole,
  isSuperAdmin,
  members,
  orgTags,
  memberTagMap,
}: MembersListProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "manager" | "member">("all");

  const isOwner = currentUserRole === "owner";
  const isAdmin = currentUserRole === "admin" || isOwner || isSuperAdmin;
  const isManager = currentUserRole === "manager";

  // Filter members based on search and role
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        search === "" ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        (m.username && m.username.toLowerCase().includes(search.toLowerCase()));

      let matchesRole = true;
      if (roleFilter === "admin") {
        matchesRole = m.role === "admin" || m.role === "owner";
      } else if (roleFilter === "manager") {
        matchesRole = m.role === "manager";
      } else if (roleFilter === "member") {
        matchesRole = m.role === "member";
      }

      return matchesSearch && matchesRole;
    });
  }, [members, search, roleFilter]);

  // Counts for tabs
  const adminCount = useMemo(
    () => members.filter((m) => m.role === "admin" || m.role === "owner").length,
    [members],
  );
  const managerCount = useMemo(
    () => members.filter((m) => m.role === "manager").length,
    [members],
  );
  const regularCount = useMemo(
    () => members.filter((m) => m.role === "member").length,
    [members],
  );

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
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
            All ({members.length})
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
            Admins ({adminCount})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("manager")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              roleFilter === "manager"
                ? "bg-sky-600 text-white dark:bg-sky-700"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Managers ({managerCount})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("member")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              roleFilter === "member"
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Members ({regularCount})
          </button>
        </div>
      </div>

      {/* Member Cards / Table */}
      {filteredMembers.length === 0 ? (
        <div className="border border-dashed border-border/70 rounded-lg p-8 text-center space-y-2">
          <Users className="size-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">No members found</p>
          <p className="text-xs text-muted-foreground">
            {search ? "Try searching with a different term." : "No members match the selected filter."}
          </p>
        </div>
      ) : (
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {filteredMembers.map((row) => {
            const isSelf = row.userId === currentUserId;
            const targetIsOwner = row.role === "owner";
            const targetIsAdmin = row.role === "admin";

            // Permission rules for changing role:
            // - Cannot change owner or self
            // - Owner or superAdmin can change any non-owner
            // - Admin can change member/manager (not admin/owner)
            // - Manager cannot change roles
            const canChangeRole =
              !isSelf &&
              !targetIsOwner &&
              (isOwner || isSuperAdmin || (isAdmin && !targetIsAdmin));

            const allowedRoles: ("admin" | "manager" | "member")[] =
              isOwner || isSuperAdmin
                ? ["admin", "manager", "member"]
                : ["manager", "member"];

            // Permission rules for removing:
            // - Cannot remove self or owner
            // - Owner or superAdmin can remove anyone else
            // - Admin can remove members/managers (not other admins or owner)
            // - Manager cannot remove anyone
            const canRemove =
              !isSelf &&
              !targetIsOwner &&
              (isOwner || isSuperAdmin || (isAdmin && !targetIsAdmin));

            return (
              <li
                key={row.memberId}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Avatar name={row.name} src={row.image} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">
                        {row.name}
                        {isSelf ? (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <MemberRoleChanger
                        organizationId={organizationId}
                        memberId={row.memberId}
                        currentRole={row.role}
                        memberName={row.name}
                        canChangeRole={canChangeRole}
                        allowedRoles={allowedRoles}
                      />
                    </div>
                    <p className="text-muted-foreground readout truncate text-xs">
                      {row.email}
                      {row.username ? ` • @${row.username}` : ""}
                    </p>

                    <MemberTagPicker
                      organizationId={organizationId}
                      memberId={row.memberId}
                      name={row.name}
                      allTags={orgTags}
                      assigned={memberTagMap[row.memberId] ?? []}
                    />
                  </div>
                </div>

                {canRemove ? (
                  <div className="shrink-0 pt-0.5">
                    <MemberActions
                      organizationId={organizationId}
                      memberIdOrEmail={row.memberId}
                      name={row.name}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

