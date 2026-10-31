import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import {
  checkIns,
  member,
  organization,
  organizationSettings,
  places,
} from "@/lib/db/schema";
import { isSuperAdmin, requireSession } from "@/lib/session";

/** Defined organization roles in order of hierarchy */
export const ORG_ROLES = ["owner", "admin", "manager", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Roles that may administer an organization (manage settings, places, member roles). */
export const ORG_ADMIN_ROLES = new Set<string>(["owner", "admin"]);

/** Roles that may access management views (attendance, live check-ins, reports, member lists). */
export const ORG_MANAGEMENT_ROLES = new Set<string>(["owner", "admin", "manager"]);

export function isOrgAdminRole(role: string | null | undefined) {
  if (!role) return false;
  return role
    .split(",")
    .map((part) => part.trim())
    .some((part) => ORG_ADMIN_ROLES.has(part));
}

export function isOrgManagerRole(role: string | null | undefined) {
  if (!role) return false;
  return role
    .split(",")
    .map((part) => part.trim())
    .some((part) => ORG_MANAGEMENT_ROLES.has(part));
}

export type Membership = {
  organizationId: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
  isAdmin: boolean;
};

export async function listMyOrganizations(
  userId: string,
): Promise<Membership[]> {
  const rows = await db
    .select({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));

  return rows.map((row) => ({ ...row, isAdmin: isOrgAdminRole(row.role) }));
}

export type AdministeredOrg = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
  timezone: string;
  memberCount: number;
  placeCount: number;
  activeCheckInsCount: number;
};

export async function listAdministeredOrganizations(
  userId: string,
): Promise<AdministeredOrg[]> {
  const orgRows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      role: member.role,
      timezone: organizationSettings.timezone,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organization.id),
    )
    .where(
      and(
        eq(member.userId, userId),
        inArray(member.role, ["owner", "admin", "manager"]),
      ),
    )
    .orderBy(asc(organization.name));

  if (orgRows.length === 0) return [];

  const orgIds = orgRows.map((r) => r.id);

  const [membersCount, placesCount, activeVisitsCount] = await Promise.all([
    db
      .select({
        organizationId: member.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(member)
      .where(inArray(member.organizationId, orgIds))
      .groupBy(member.organizationId),
    db
      .select({
        organizationId: places.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(places)
      .where(inArray(places.organizationId, orgIds))
      .groupBy(places.organizationId),
    db
      .select({
        organizationId: checkIns.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(checkIns)
      .where(
        and(
          inArray(checkIns.organizationId, orgIds),
          isNull(checkIns.checkedOutAt),
        ),
      )
      .groupBy(checkIns.organizationId),
  ]);

  const memberMap = new Map(membersCount.map((m) => [m.organizationId, m.count]));
  const placeMap = new Map(placesCount.map((p) => [p.organizationId, p.count]));
  const visitMap = new Map(activeVisitsCount.map((v) => [v.organizationId, v.count]));

  return orgRows.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    role: org.role,
    timezone: org.timezone ?? "UTC",
    memberCount: memberMap.get(org.id) ?? 0,
    placeCount: placeMap.get(org.id) ?? 0,
    activeCheckInsCount: visitMap.get(org.id) ?? 0,
  }));
}

/**
 * Loads an organization only if the signed-in user may administer it: either an
 * owner/admin member, or an app-level super admin, who oversees every
 * organization and is usually not a member of the ones they create for others.
 *
 * If `options.allowManager` is true, users with role "manager" are also permitted.
 *
 * Anyone else gets a 404 rather than a redirect, so the URL leaks nothing about
 * which organizations exist.
 */
export async function requireOrgAdmin(
  organizationId: string,
  options?: { allowManager?: boolean },
) {
  const session = await requireSession();

  // Selected FROM organization with the membership joined on, so an admin who
  // is not a member still resolves the organization itself.
  const [row] = await db
    .select({
      role: member.role,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      timezone: organizationSettings.timezone,
      allowManualCheckIn: organizationSettings.allowManualCheckIn,
    })
    .from(organization)
    .leftJoin(
      member,
      and(
        eq(member.organizationId, organization.id),
        eq(member.userId, session.user.id),
      ),
    )
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organization.id),
    )
    .where(eq(organization.id, organizationId))
    .limit(1);

  const superAdmin = isSuperAdmin(session.user);
  const allowManager = options?.allowManager ?? false;

  const hasAccess =
    superAdmin ||
    isOrgAdminRole(row?.role) ||
    (allowManager && isOrgManagerRole(row?.role));

  if (!row || !hasAccess) notFound();

  return {
    session,
    isSuperAdmin: superAdmin,
    isOwner: row.role === "owner",
    isAdmin: isOrgAdminRole(row.role) || superAdmin,
    isManager: row.role === "manager",
    userRole: superAdmin
      ? ("admin" as const)
      : ((row.role ?? "member") as OrgRole),
    organization: {
      id: organizationId,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      timezone: row.timezone ?? "UTC",
      allowManualCheckIn: row.allowManualCheckIn ?? false,
    },
  };
}

/**
 * For anything a member of an organization may do. Super admins pass without a
 * membership row, since they oversee every organization.
 */
export async function requireMembership(organizationId: string) {
  const session = await requireSession();
  const superAdmin = isSuperAdmin(session.user);

  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!row && !superAdmin) redirect("/orgs");

  return {
    session,
    role: row?.role ?? null,
    isMember: Boolean(row),
    isAdmin: superAdmin || isOrgAdminRole(row?.role),
  };
}
