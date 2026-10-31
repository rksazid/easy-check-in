"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ExternalLink,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";

import { LocalTime } from "@/components/local-time";
import { ManualCheckInSwitch } from "@/components/manual-check-in-switch";
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
import { CreateOrganizationForm } from "../sa/create-organization-form";

export type AdminOrgItem = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  timezone: string | null;
  memberCount: number;
  allowManualCheckIn?: boolean | null;
};

type OrganizationsTableProps = {
  organizations: AdminOrgItem[];
};

export function OrganizationsTable({ organizations }: OrganizationsTableProps) {
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filteredOrgs = useMemo(() => {
    const q = search.toLowerCase();
    return organizations.filter(
      (org) =>
        search === "" ||
        org.name.toLowerCase().includes(q) ||
        org.slug.toLowerCase().includes(q),
    );
  }, [organizations, search]);

  return (
    <div className="space-y-6">
      {/* Create Organization Form Card (Collapsible for Clean Mobile & Desktop UX) */}
      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="size-4 text-primary" />
              New Organization
            </h3>
            <p className="text-xs text-muted-foreground">
              Register a new organization workspace for check-ins
            </p>
          </div>
          <Button
            type="button"
            variant={showCreateForm ? "outline" : "default"}
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-xs gap-1.5 h-8 px-3 shrink-0"
          >
            <Plus
              className={`size-3.5 transition-transform duration-200 ${
                showCreateForm ? "rotate-45" : ""
              }`}
            />
            {showCreateForm ? "Cancel" : "Add Organization"}
          </Button>
        </div>

        {showCreateForm ? (
          <div className="pt-3 border-t border-border/60">
            <CreateOrganizationForm />
          </div>
        ) : null}
      </div>

      {/* Organizations Section */}
      <div className="space-y-3">
        {/* Search & Counter Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations by name or slug..."
              className="pl-8 h-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Total: {organizations.length}{" "}
            {organizations.length === 1 ? "organization" : "organizations"}
          </span>
        </div>

        {filteredOrgs.length === 0 ? (
          <div className="border border-dashed border-border/70 rounded-lg p-8 text-center space-y-2">
            <Building2 className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">No organizations found</p>
            <p className="text-xs text-muted-foreground">
              {search
                ? "No organizations matched your search terms."
                : "No organizations have been created yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Card View (No Horizontal Scroll, Full Name Visibility) */}
            <div className="grid gap-3 sm:hidden">
              {filteredOrgs.map((org) => (
                <div
                  key={org.id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-3.5 transition-all touch-press"
                >
                  {/* Card Header: Icon + Full Name + Member Count */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <OrgIcon
                        logo={org.logo}
                        name={org.name}
                        size="md"
                        className="shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm text-foreground break-words leading-tight">
                          {org.name}
                        </h4>
                        <p className="readout text-muted-foreground text-xs font-mono mt-0.5">
                          {org.slug}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs px-2 py-0.5 font-medium flex items-center gap-1"
                    >
                      <Users className="size-3 text-muted-foreground" />
                      {org.memberCount}
                    </Badge>
                  </div>

                  {/* Metadata Row: Timezone & Creation Date */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-y border-border/50 py-2.5">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Timezone
                      </span>
                      <span className="font-medium text-foreground">
                        {org.timezone ?? "UTC"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Created
                      </span>
                      <span className="font-medium text-foreground">
                        <LocalTime value={org.createdAt} format="date" />
                      </span>
                    </div>
                  </div>

                  {/* Settings & Actions Strip */}
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        Manual Entry:
                      </span>
                      <ManualCheckInSwitch
                        organizationId={org.id}
                        enabled={org.allowManualCheckIn ?? false}
                        showBadge={true}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                      >
                        <Link href={`/orgs/${org.id}`}>
                          <ExternalLink className="size-3.5 mr-1 text-muted-foreground" />
                          Public
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        className="h-8 px-2.5 text-xs font-medium"
                      >
                        <Link href={`/admin/${org.id}`}>
                          <Settings className="size-3.5 mr-1" />
                          Manage
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Full Table View (>= sm breakpoint) */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Organization</TableHead>
                    <TableHead className="w-[120px]">Timezone</TableHead>
                    <TableHead className="w-[80px] text-center">Members</TableHead>
                    <TableHead className="w-[140px]">Manual Entry</TableHead>
                    <TableHead className="w-[110px]">Created</TableHead>
                    <TableHead className="text-right min-w-[140px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <TableRow key={org.id}>
                      {/* Name & Slug */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <OrgIcon logo={org.logo} name={org.name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate">
                              {org.name}
                            </p>
                            <p className="readout text-muted-foreground text-[11px] truncate">
                              {org.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Timezone */}
                      <TableCell className="text-muted-foreground text-[11px]">
                        {org.timezone ?? "UTC"}
                      </TableCell>

                      {/* Members Count */}
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="font-semibold text-[11px] px-2 py-0"
                        >
                          {org.memberCount}
                        </Badge>
                      </TableCell>

                      {/* Manual Check-in Toggle */}
                      <TableCell>
                        <ManualCheckInSwitch
                          organizationId={org.id}
                          enabled={org.allowManualCheckIn ?? false}
                        />
                      </TableCell>

                      {/* Created */}
                      <TableCell className="text-muted-foreground whitespace-nowrap text-[11px]">
                        <LocalTime value={org.createdAt} format="date" />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                          >
                            <Link href={`/orgs/${org.id}`}>
                              <ExternalLink className="size-3 mr-1 text-muted-foreground" />
                              Public
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            className="h-7 px-2.5 text-[11px]"
                          >
                            <Link href={`/admin/${org.id}`}>
                              <Settings className="size-3 mr-1" />
                              Manage
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
