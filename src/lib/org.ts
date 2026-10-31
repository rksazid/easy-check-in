import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { member, organization, organizationSettings } from "@/lib/db/schema";
import { isSuperAdmin, requireSession } from "@/lib/session";

/** Roles that may manage an organization. `owner` is what the creator gets. */
const ORG_ADMIN_ROLES = new Set(["owner", "admin"]);

export function isOrgAdminRole(role: string | null | undefined) {
  if (!role) return false;
  return role
    .split(",")
    .map((part) => part.trim())
    .some((part) => ORG_ADMIN_ROLES.has(part));
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

/**
 * Loads an organization only if the signed-in user may administer it: either an
 * owner/admin member, or an app-level super admin, who oversees every
 * organization and is usually not a member of the ones they create for others.
 *
 * Anyone else gets a 404 rather than a redirect, so the URL leaks nothing about
 * which organizations exist.
 */
export async function requireOrgAdmin(organizationId: string) {
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

  if (!row || (!superAdmin && !isOrgAdminRole(row.role))) notFound();

  return {
    session,
    isSuperAdmin: superAdmin,
    organization: {
      id: organizationId,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      timezone: row.timezone ?? "UTC",
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
