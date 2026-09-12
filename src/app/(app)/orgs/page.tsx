import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";

import { BrowseOrganizations } from "./browse-organizations";
import { InvitationActions, RequestActions } from "./request-actions";
import { listJoinableOrganizations } from "@/actions/organizations";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { joinRequests, organization } from "@/lib/db/schema";
import { listMyOrganizations } from "@/lib/org";
import { requireSession } from "@/lib/session";
import { headers } from "next/headers";

export const metadata = { title: "Organizations · Easy Check-In" };

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
      auth.api
        .listUserInvitations({ headers: await headers() })
        .catch(() => []),
      listJoinableOrganizations(),
    ]);

  const openInvitations = invitations.filter(
    (invitation) => invitation.status === "pending",
  );

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm">
          You can check in at places belonging to any organization you&rsquo;re
          in.
        </p>
      </div>

      {openInvitations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Invitations waiting for you
          </h2>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {openInvitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="font-medium">
                  {invitation.organizationName ?? "An organization"}
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
            You&rsquo;re not in an organization yet. Ask to join one below.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {memberships.map((membership) => (
              <li
                key={membership.organizationId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">{membership.name}</span>
                  {membership.isAdmin ? (
                    <Badge variant="secondary">{membership.role}</Badge>
                  ) : null}
                </span>
                <span className="flex items-center gap-4">
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
