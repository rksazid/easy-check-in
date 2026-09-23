import { and, asc, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";

import { AdminCheckOutButton } from "./admin-check-out-button";
import { InviteMember } from "./invite-member";
import { MemberTagPicker } from "./member-tag-picker";
import { JoinRequestActions, MemberActions } from "./member-actions";
import { SlackSettings } from "./slack-settings";
import { TagManager } from "./tag-manager";
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
import { countTagUse, listOrganizationTags, tagsByMember } from "@/lib/tags";
import { maskWebhookUrl } from "@/lib/slack/post";
import { organizationSettings } from "@/lib/db/schema";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[orgId]">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);
  return { title: `Manage ${organization.name}` };
}

export default async function OrgAdminPage({
  params,
}: PageProps<"/admin/[orgId]">) {
  const { orgId } = await params;
  const { organization, session } = await requireOrgAdmin(orgId);

  // Closes anything left open past the cap before the admin looks at the list.
  await sweepForgottenCheckIns();

  const [
    members,
    requests,
    pendingInvitations,
    openVisits,
    orgTags,
    tagUse,
    memberTagMap,
    settingsRows,
  ] = await Promise.all([
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
      listOrganizationTags(orgId),
      countTagUse(orgId),
      tagsByMember(orgId),
      db
        .select({
          slackWebhookUrl: organizationSettings.slackWebhookUrl,
          slackNotifyEvents: organizationSettings.slackNotifyEvents,
        })
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, orgId))
        .limit(1),
    ]);

  const slack = settingsRows[0];

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
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/orgs/${orgId}/places`}>Places</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/${orgId}/check-ins`}>Check-ins</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/${orgId}/reports`}>Reports</Link>
          </Button>
        </div>
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
                    <p className="border-border/70 border-l-2 pl-3 text-sm">
                      {request.message}
                    </p>
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
                    {visit.placeName}, here{" "}
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
            <li key={row.memberId} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <Avatar name={row.name} src={row.image} />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
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
                <MemberTagPicker
                  organizationId={orgId}
                  memberId={row.memberId}
                  name={row.name}
                  allTags={orgTags}
                  assigned={memberTagMap.get(row.memberId) ?? []}
                />
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
        <h2 className="text-sm font-semibold">Tags</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Labels for the people here, usually the project or team they are on.
          They belong to this organization only, so the same person can carry
          different tags elsewhere.
        </p>
        <TagManager organizationId={orgId} tags={tagUse} />
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
        <h2 className="text-sm font-semibold">Slack</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Send a daily summary, and a nudge when something needs an admin, to a
          channel of your choice.
        </p>
        <SlackSettings
          organizationId={orgId}
          connected={
            slack?.slackWebhookUrl
              ? maskWebhookUrl(slack.slackWebhookUrl)
              : null
          }
          notifyEvents={slack?.slackNotifyEvents ?? true}
        />
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
