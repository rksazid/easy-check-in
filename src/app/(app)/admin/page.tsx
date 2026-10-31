import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  MapPin,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";

import { getPlatformStats, listAllPlatformUsers } from "@/actions/users";
import { listAllPlaceTypesForAdmin } from "@/actions/place-types";
import { LocalTime } from "@/components/local-time";
import { OrgIcon } from "@/components/org-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { member, organization, organizationSettings } from "@/lib/db/schema";
import { listAdministeredOrganizations } from "@/lib/org";
import { isSuperAdmin, requireSession } from "@/lib/session";
import { RoleBadge } from "./[orgId]/member-role-changer";
import { PlatformUserManager } from "./platform-user-manager";
import { CreateOrganizationForm } from "../sa/create-organization-form";
import { PlaceTypeManager } from "../sa/place-type-manager";

export const metadata = { title: "Admin Panel" };

export default async function AdminHubPage() {
  const session = await requireSession();
  const superAdmin = isSuperAdmin(session.user);

  // Load organizations the user administers (owner, admin, or manager)
  const managedOrgs = await listAdministeredOrganizations(session.user.id);

  // If the user has neither platform superadmin nor org management rights:
  if (!superAdmin && managedOrgs.length === 0) {
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <Shield className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Access Restricted</h1>
          <p className="text-sm text-muted-foreground">
            You do not currently have administrative or manager access to any
            organization.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Contact your organization owner or administrator to grant you access.
        </p>
        <div className="pt-2 flex justify-center gap-2">
          <Button asChild variant="default" size="sm">
            <Link href="/">Back to Check in</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/orgs">Browse Organizations</Link>
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Organizational Admin / Manager View (Non-Super Admin)
  // --------------------------------------------------------------------------
  if (!superAdmin) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
            <Badge variant="outline" className="text-xs font-medium">
              Organization Level
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            You have administrative or operational access for the following{" "}
            {managedOrgs.length}{" "}
            {managedOrgs.length === 1 ? "organization" : "organizations"}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {managedOrgs.map((org) => (
            <div
              key={org.id}
              className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <OrgIcon logo={org.logo} name={org.name} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">{org.name}</p>
                      <p className="readout text-muted-foreground text-xs font-normal">
                        {org.slug}
                      </p>
                    </div>
                  </div>
                  <RoleBadge role={org.role} />
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-center text-xs">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {org.memberCount}
                    </p>
                    <p className="text-muted-foreground text-[11px]">Members</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {org.placeCount}
                    </p>
                    <p className="text-muted-foreground text-[11px]">Places</p>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                      {org.activeCheckInsCount}
                    </p>
                    <p className="text-muted-foreground text-[11px]">Active Now</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 flex flex-wrap gap-2">
                <Button asChild size="sm" className="flex-1 min-w-[120px]">
                  <Link href={`/admin/${org.id}`}>Manage Members</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/${org.id}/check-ins`}>
                    <Clock className="size-3.5 mr-1" />
                    Check-ins
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/${org.id}/reports`}>
                    <FileSpreadsheet className="size-3.5 mr-1" />
                    Reports
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/orgs/${org.id}/places`}>
                    <MapPin className="size-3.5 mr-1" />
                    Places
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Super Admin Platform View
  // --------------------------------------------------------------------------
  const [stats, allUsers, allOrganizations, placeTypesList] = await Promise.all([
    getPlatformStats(),
    listAllPlatformUsers(),
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
        timezone: organizationSettings.timezone,
        memberCount: sql<number>`count(${member.id})::int`,
      })
      .from(organization)
      .leftJoin(member, eq(member.organizationId, organization.id))
      .leftJoin(
        organizationSettings,
        eq(organizationSettings.organizationId, organization.id),
      )
      .groupBy(
        organization.id,
        organization.name,
        organization.slug,
        organization.logo,
        organization.createdAt,
        organizationSettings.timezone,
      )
      .orderBy(asc(organization.name)),
    listAllPlaceTypesForAdmin(),
  ]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Platform Admin</h1>
          <Badge
            variant="outline"
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 gap-1 text-xs font-medium"
          >
            <ShieldCheck className="size-3 text-indigo-500" />
            Super Admin
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Platform-wide user management, organization oversight, and system place
          types.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Registered Users</span>
            <Users className="size-4" />
          </div>
          <p className="text-2xl font-bold">{stats.totalUsers}</p>
          <p className="text-[11px] text-muted-foreground">
            {stats.superAdminsCount} super {stats.superAdminsCount === 1 ? "admin" : "admins"}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Organizations</span>
            <Building2 className="size-4" />
          </div>
          <p className="text-2xl font-bold">{stats.totalOrganizations}</p>
          <p className="text-[11px] text-muted-foreground">Active workspaces</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Today&apos;s Check-ins</span>
            <CalendarCheck className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.todayCheckInsCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Across all places</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Places</span>
            <MapPin className="size-4" />
          </div>
          <p className="text-2xl font-bold">{stats.totalPlaces}</p>
          <p className="text-[11px] text-muted-foreground">Geofenced locations</p>
        </div>
      </div>

      {/* Section 1: User Management */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">User Management</h2>
          <p className="text-xs text-muted-foreground">
            Manage all platform accounts, assign or revoke Super Admin roles, and
            manage account status.
          </p>
        </div>
        <PlatformUserManager
          initialUsers={allUsers}
          currentUserId={session.user.id}
        />
      </section>

      {/* Section 2: Create Organization */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Create Organization</h2>
        <CreateOrganizationForm />
      </section>

      {/* Section 3: All Organizations */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            All Organizations ({allOrganizations.length})
          </h2>
        </div>

        {allOrganizations.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            No organizations yet.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {allOrganizations.map((org) => (
              <li
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <OrgIcon logo={org.logo} name={org.name} size="md" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {org.name}{" "}
                      <span className="readout text-muted-foreground text-xs font-normal">
                        {org.slug}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {org.memberCount}{" "}
                      {org.memberCount === 1 ? "member" : "members"}, on{" "}
                      {org.timezone ?? "UTC"}, created{" "}
                      <LocalTime value={org.createdAt} format="date" />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/orgs/${org.id}`}>Public Page</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/admin/${org.id}`}>Manage Org</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 4: Place Types Manager */}
      <section className="space-y-3">
        <PlaceTypeManager initialPlaceTypes={placeTypesList} />
      </section>
    </div>
  );
}

