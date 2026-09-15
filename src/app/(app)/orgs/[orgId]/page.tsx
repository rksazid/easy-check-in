import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { organization, organizationSettings } from "@/lib/db/schema";
import { isOrgAdminRole, requireMembership } from "@/lib/org";
import { getOrganizationSummary, listOrganizationMembers } from "@/lib/visits";

export async function generateMetadata({
  params,
}: PageProps<"/orgs/[orgId]">) {
  const { orgId } = await params;
  await requireMembership(orgId);

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  return { title: org?.name ?? "Organization" };
}

export default async function OrganizationPage({
  params,
}: PageProps<"/orgs/[orgId]">) {
  const { orgId } = await params;
  const { session, isAdmin } = await requireMembership(orgId);

  const [org] = await db
    .select({
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      timezone: organizationSettings.timezone,
    })
    .from(organization)
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organization.id),
    )
    .where(eq(organization.id, orgId))
    .limit(1);

  if (!org) notFound();

  const [members, summary] = await Promise.all([
    listOrganizationMembers(orgId),
    getOrganizationSummary(orgId),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link
          href="/orgs"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to organizations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-muted-foreground text-sm">
          Started <LocalTime value={org.createdAt} format="date" />. Reporting
          months run on <span className="readout">{org.timezone ?? "UTC"}</span>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/orgs/${orgId}/places`}>Places</Link>
        </Button>
        {isAdmin ? (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/${orgId}`}>Manage</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/${orgId}/reports`}>Reports</Link>
            </Button>
          </>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People" value={String(members.length)} />
        <Stat label="Places" value={String(summary.openPlaces)} />
        <Stat label="Here now" value={String(summary.hereNow)} />
        <Stat label="Visits this week" value={String(summary.visitsThisWeek)} />
      </dl>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">People</h2>
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {members.map((row) => (
            <li key={row.memberId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={row.name} src={row.image} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {row.name}
                  {row.userId === session.user.id ? (
                    <Badge variant="outline">You</Badge>
                  ) : null}
                  {isOrgAdminRole(row.role) ? (
                    <Badge variant="secondary">{row.role}</Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {row.username ? (
                    <span className="readout">@{row.username}</span>
                  ) : null}
                  {row.username ? ", " : ""}
                  joined <LocalTime value={row.joinedAt} format="date" />
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 rounded-lg border px-3 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="readout mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}
