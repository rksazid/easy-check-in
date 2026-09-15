import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";

import { BrowseOrganizations } from "./browse-organizations";
import { InvitationActions, RequestActions } from "./request-actions";
import { listJoinableOrganizations } from "@/actions/organizations";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db/client";
import { joinRequests, organization } from "@/lib/db/schema";
import { listMyInvitations } from "@/lib/invitations";
import { listMyOrganizations } from "@/lib/org";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Organizations" };

export default async function OrganizationsPage() {
  const session = await requireSession();

  const [memberships, pendingRequests, invitations, joinable] =
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
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {memberships.map((membership) => (
              <li
                key={membership.organizationId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <Link
                  href={`/orgs/${membership.organizationId}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="truncate font-medium underline-offset-4 hover:underline">
                    {membership.name}
                  </span>
                  {membership.isAdmin ? (
                    <Badge variant="secondary">{membership.role}</Badge>
                  ) : null}
                </Link>
                <span className="flex shrink-0 items-center gap-4">
                  {/* Anyone here can add a place, so everyone gets this link. */}
                  <Link
                    href={`/orgs/${membership.organizationId}/places`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    Places
                  </Link>
                  {membership.isAdmin ? (
                    <Link
                      href={`/admin/${membership.organizationId}`}
                      className="text-sm font-medium underline underline-offset-4"
                    >
                      Manage
                    </Link>
                  ) : null}
                </span>
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
