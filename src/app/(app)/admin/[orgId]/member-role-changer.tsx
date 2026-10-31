"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Crown, Shield, UserCheck, User } from "lucide-react";

import { updateMemberRole } from "@/actions/organizations";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type MemberRoleChangerProps = {
  organizationId: string;
  memberId: string;
  currentRole: string;
  memberName: string;
  canChangeRole: boolean;
  allowedRoles?: ("admin" | "manager" | "member")[];
};

export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "owner":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 font-medium"
        >
          <Crown className="size-3 text-amber-500" />
          Owner
        </Badge>
      );
    case "admin":
      return (
        <Badge
          variant="outline"
          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 gap-1 font-medium"
        >
          <Shield className="size-3 text-indigo-500" />
          Admin
        </Badge>
      );
    case "manager":
      return (
        <Badge
          variant="outline"
          className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400 gap-1 font-medium"
        >
          <UserCheck className="size-3 text-sky-500" />
          Manager
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className="gap-1 font-normal text-muted-foreground"
        >
          <User className="size-3" />
          Member
        </Badge>
      );
  }
}

export function MemberRoleChanger({
  organizationId,
  memberId,
  currentRole,
  memberName,
  canChangeRole,
  allowedRoles = ["admin", "manager", "member"],
}: MemberRoleChangerProps) {
  const [isPending, startTransition] = useTransition();

  if (!canChangeRole || currentRole === "owner") {
    return <RoleBadge role={currentRole} />;
  }

  function handleRoleChange(newRole: string) {
    if (newRole === currentRole) return;

    if (
      !confirm(
        `Change ${memberName}'s role from ${currentRole} to ${newRole}?`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await updateMemberRole(
        organizationId,
        memberId,
        newRole as "admin" | "manager" | "member",
      );

      if (res.ok) {
        toast.success(`Updated ${memberName}'s role to ${newRole}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentRole}
        onValueChange={handleRoleChange}
        disabled={isPending}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            "h-7 text-xs font-medium border-border/70",
            currentRole === "admin" && "border-indigo-500/40 text-indigo-700 dark:text-indigo-400",
            currentRole === "manager" && "border-sky-500/40 text-sky-700 dark:text-sky-400",
            currentRole === "member" && "text-muted-foreground",
          )}
        >
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent align="end">
          {allowedRoles.includes("admin") && (
            <SelectItem value="admin">
              <span className="flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                <Shield className="size-3.5" />
                Admin
              </span>
            </SelectItem>
          )}
          {allowedRoles.includes("manager") && (
            <SelectItem value="manager">
              <span className="flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400">
                <UserCheck className="size-3.5" />
                Manager
              </span>
            </SelectItem>
          )}
          {allowedRoles.includes("member") && (
            <SelectItem value="member">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <User className="size-3.5" />
                Member
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

