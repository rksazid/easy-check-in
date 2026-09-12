import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { CreateOrganizationForm } from "./create-organization-form";
import { LocalTime } from "@/components/local-time";
import { db } from "@/lib/db/client";
import { member, organization, organizationSettings } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/session";

export const metadata = { title: "Super admin · Easy Check-In" };

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const organizations = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
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
      organization.createdAt,
      organizationSettings.timezone,
    )
    .orderBy(asc(organization.name));

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Super admin</h1>
        <p className="text-muted-foreground text-sm">
          Create organizations and hand them to an admin.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">New organization</h2>
        <CreateOrganizationForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          All organizations ({organizations.length})
        </h2>
        {organizations.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            No organizations yet.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {organizations.map((org) => (
              <li
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{org.name}</p>
                  <p className="text-muted-foreground text-xs">
                    <span className="readout">{org.slug}</span>
                    {" · "}
                    {org.memberCount}{" "}
                    {org.memberCount === 1 ? "member" : "members"}
                    {" · "}
                    {org.timezone ?? "UTC"}
                    {" · created "}
                    <LocalTime value={org.createdAt} format="date" />
                  </p>
                </div>
                <Link
                  href={`/admin/${org.id}`}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
