import { and, asc, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";

import { AdminCheckOutButton } from "./admin-check-out-button";
import { InviteMember } from "./invite-member";
import { JoinRequestActions, MemberActions } from "./member-actions";
import { TimezoneForm } from "./timezone-form";
import { sweepForgottenCheckIns } from "@/actions/check-in";
import { Avatar } from "@/components/avatar";
import { Elapsed } from "@/components/elapsed";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import {
  checkIns,
  invitation,
  joinRequests,
  member,
  places,
  user as userTable,
} from "@/lib/db/schema";
import { isOrgAdminRole, requireOrgAdmin } from "@/lib/org";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[orgId]">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);
  return { title: `${organization.name} · Easy Check-In` };
}

export default async function OrgAdminPage({
  params,
}: PageProps<"/admin/[orgId]">) {
  const { orgId } = await params;
  const { organization, session } = await requireOrgAdmin(orgId);

  // Closes anything left open past the cap before the admin looks at the list.
  await sweepForgottenCheckIns();

  const [members, requests, pendingInvitations, openVisits] = await Promise.all([
    db
      .select({
        memberId: member.id,
        role: member.role,
        joinedAt: member.createdAt,
        userId: userTable.id,
        name: userTable.name,
        email: userTable.email,
        username: userTable.username,
        image: userTable.image,
      })
      .from(member)
      .innerJoin(userTable, eq(member.userId, userTable.id))
      .where(eq(member.organizationId, orgId))
      .orderBy(asc(userTable.name)),
    db
      .select({
        id: joinRequests.id,
        message: joinRequests.message,
        createdAt: joinRequests.createdAt,
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
      })
      .from(joinRequests)
      .innerJoin(userTable, eq(joinRequests.userId, userTable.id))
      .where(
        and(
          eq(joinRequests.organizationId, orgId),
          eq(joinRequests.status, "pending"),
        ),
      )
      .orderBy(desc(joinRequests.createdAt)),
    db
      .select({ id: invitation.id, email: invitation.email })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.status, "pending"),
        ),
      ),
    db
      .select({
        id: checkIns.id,
        checkedInAt: checkIns.checkedInAt,
        name: userTable.name,
        image: userTable.image,
        placeName: places.name,
      })
      .from(checkIns)
      .innerJoin(userTable, eq(checkIns.userId, userTable.id))
      .innerJoin(places, eq(checkIns.placeId, places.id))
      .where(
        and(
          eq(checkIns.organizationId, orgId),
          isNull(checkIns.checkedOutAt),
        ),
      )
      .orderBy(asc(checkIns.checkedInAt)),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {organization.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/${orgId}/places`}>Places</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Requests to join
          {requests.length > 0 ? (
            <Badge className="ml-2">{requests.length}</Badge>
          ) : null}
        </h2>
        {requests.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
            Nothing waiting.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {requests.map((request) => (
              <li key={request.id} className="flex gap-3 px-4 py-3">
                <Avatar name={request.name} src={request.image} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{request.name}</p>
                  <p className="text-muted-foreground readout truncate text-xs">
                    {request.email}
                  </p>
                  {request.message ? (
                    <p className="text-sm">&ldquo;{request.message}&rdquo;</p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    <LocalTime value={request.createdAt} format="date" />
                  </p>
                </div>
                <JoinRequestActions requestId={request.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {openVisits.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Here right now</h2>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {openVisits.map((visit) => (
              <li
                key={visit.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar name={visit.name} src={visit.image} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{visit.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {visit.placeName} ·{" "}
                    <Elapsed since={visit.checkedInAt} />
                  </p>
                </div>
                <AdminCheckOutButton
                  organizationId={orgId}
                  checkInId={visit.id}
                  name={visit.name}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Members</h2>
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {members.map((row) => (
            <li key={row.memberId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={row.name} src={row.image} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {row.name}
                  {isOrgAdminRole(row.role) ? (
                    <Badge variant="secondary">{row.role}</Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground readout truncate text-xs">
                  {row.email}
                </p>
              </div>
              {row.userId === session.user.id || row.role === "owner" ? null : (
                <MemberActions
                  organizationId={orgId}
                  memberIdOrEmail={row.memberId}
                  name={row.name}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Invite someone</h2>
        <InviteMember organizationId={orgId} />
        {pendingInvitations.length > 0 ? (
          <div className="text-muted-foreground space-y-1 text-sm">
            <p>Waiting to be accepted:</p>
            <ul className="readout space-y-0.5 text-xs">
              {pendingInvitations.map((row) => (
                <li key={row.id}>{row.email}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Time zone</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Monthly reports start and end at midnight in this zone. Everyone still
          sees check-in times in their own local time.
        </p>
        <TimezoneForm
          organizationId={orgId}
          timezone={organization.timezone}
        />
      </section>
    </div>
  );
}
