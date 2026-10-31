import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { MapPin, Settings } from "lucide-react";

import { BrowseOrganizations } from "./browse-organizations";
import { InvitationActions, RequestActions } from "./request-actions";
import { listJoinableOrganizations } from "@/actions/organizations";
import { LocalTime } from "@/components/local-time";
import { OrgIcon } from "@/components/org-icon";
import { TagBadge } from "@/components/tag-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { joinRequests, organization } from "@/lib/db/schema";
import { listMyInvitations } from "@/lib/invitations";
import { listMyOrganizations } from "@/lib/org";
import { myTagsByOrganization } from "@/lib/tags";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Organizations" };

export default async function OrganizationsPage() {
  const session = await requireSession();

  const [memberships, pendingRequests, invitations, joinable, myTags] =
    await Promise.all([
      listMyOrganizations(session.user.id),
      db
        .select({
          id: joinRequests.id,
          createdAt: joinRequests.createdAt,
          organizationName: organization.name,
        })
        .from(joinRequests)
        .innerJoin(organization, eq(joinRequests.organizationId, organization.id))
        .where(
          and(
            eq(joinRequests.userId, session.user.id),
            eq(joinRequests.status, "pending"),
          ),
        )
        .orderBy(desc(joinRequests.createdAt)),
      listMyInvitations(session.user.email),
      listJoinableOrganizations(),
      myTagsByOrganization(session.user.id),
    ]);

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm">
          Check in at places run by any organization you have joined.
        </p>
      </div>

      {invitations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Invitations waiting for you
          </h2>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {invitation.organizationName}
                  </span>
                  {invitation.invitedByName ? (
                    <span className="text-muted-foreground text-xs">
                      Invited by {invitation.invitedByName}
                    </span>
                  ) : null}
                </span>
                <InvitationActions invitationId={invitation.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">You belong to</h2>
        {memberships.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            You have not joined an organization yet. Ask to join one below.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 bg-card divide-y rounded-xl border shadow-xs overflow-hidden">
            {memberships.map((membership) => (
              <li
                key={membership.organizationId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/30"
              >
                <Link
                  href={`/orgs/${membership.organizationId}`}
                  className="min-w-0 flex-1 space-y-1.5 group"
                >
                  <div className="flex items-start sm:items-center gap-2.5">
                    <OrgIcon logo={membership.logo} name={membership.name} size="sm" className="shrink-0 mt-0.5 sm:mt-0" />
                    <span className="font-semibold text-sm group-hover:underline underline-offset-4 break-words leading-tight">
                      {membership.name}
                    </span>
                    {membership.isAdmin ? (
                      <Badge variant="secondary" className="capitalize text-xs font-normal shrink-0">
                        {membership.role}
                      </Badge>
                    ) : null}
                  </div>
                  {/* What this organization labels you as. */}
                  {(myTags.get(membership.organizationId) ?? []).length > 0 ? (
                    <span className="flex flex-wrap gap-1 pt-0.5">
                      {(myTags.get(membership.organizationId) ?? []).map(
                        (tag) => (
                          <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                        ),
                      )}
                    </span>
                  ) : null}
                </Link>
                <div className="flex items-center gap-2 pt-1 sm:pt-0 shrink-0">
                  <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs flex-1 sm:flex-initial">
                    <Link href={`/orgs/${membership.organizationId}/places`}>
                      <MapPin className="size-3.5 text-muted-foreground" />
                      Places
                    </Link>
                  </Button>
                  {membership.isAdmin ? (
                    <Button asChild size="sm" className="h-8 gap-1.5 text-xs flex-1 sm:flex-initial">
                      <Link href={`/admin/${membership.organizationId}`}>
                        <Settings className="size-3.5" />
                        Manage
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingRequests.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Waiting for approval</h2>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span>
                  <span className="font-medium">
                    {request.organizationName}
                  </span>
                  <span className="text-muted-foreground ml-2 text-sm">
                    asked <LocalTime value={request.createdAt} format="date" />
                  </span>
                </span>
                <RequestActions requestId={request.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BrowseOrganizations organizations={joinable} />
    </div>
  );
}
