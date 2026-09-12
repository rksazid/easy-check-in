import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { member, organization, organizationSettings } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";

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
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));

  return rows.map((row) => ({ ...row, isAdmin: isOrgAdminRole(row.role) }));
}

/**
 * Loads an organization only if the signed-in user administers it. Members who
 * are not admins get a 404 rather than a redirect, so the URL leaks nothing
 * about which organizations exist.
 */
export async function requireOrgAdmin(organizationId: string) {
  const session = await requireSession();

  const [row] = await db
    .select({
      role: member.role,
      name: organization.name,
      slug: organization.slug,
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
        eq(member.userId, session.user.id),
        eq(member.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!row || !isOrgAdminRole(row.role)) notFound();

  return {
    session,
    organization: {
      id: organizationId,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone ?? "UTC",
    },
  };
}

export async function requireMembership(organizationId: string) {
  const session = await requireSession();

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

  if (!row) redirect("/orgs");
  return { session, role: row.role, isAdmin: isOrgAdminRole(row.role) };
}
