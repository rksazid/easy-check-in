import { and, asc, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { Shield, UserCheck } from "lucide-react";

import { AdminCheckOutButton } from "./admin-check-out-button";
import { InviteMember } from "./invite-member";
import { MembersList } from "./members-list";
import { JoinRequestActions } from "./member-actions";
import { RoleBadge } from "./member-role-changer";
import { OrgIconForm } from "./org-icon-form";
import { SlackSettings } from "./slack-settings";
import { TagManager } from "./tag-manager";
import { TimezoneForm } from "./timezone-form";
import { sweepForgottenCheckIns } from "@/actions/check-in";
import { Avatar } from "@/components/avatar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Elapsed } from "@/components/elapsed";
import { LocalTime } from "@/components/local-time";
import { ManualCheckInSwitch } from "@/components/manual-check-in-switch";
import { OrgIcon } from "@/components/org-icon";
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
import { requireOrgAdmin } from "@/lib/org";
import { countTagUse, listOrganizationTags, tagsByMember } from "@/lib/tags";
import { maskWebhookUrl } from "@/lib/slack/post";
import { organizationSettings } from "@/lib/db/schema";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[orgId]">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId, { allowManager: true });
  return { title: `Manage ${organization.name}` };
}

export default async function OrgAdminPage({
  params,
}: PageProps<"/admin/[orgId]">) {
  const { orgId } = await params;
  const {
    organization,
    session,
    isSuperAdmin,
    isOwner,
    isAdmin,
    isManager,
    userRole,
  } = await requireOrgAdmin(orgId, { allowManager: true });

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
        allowManualCheckIn: organizationSettings.allowManualCheckIn,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1),
  ]);

  const slack = settingsRows[0];
  const canAdministerSettings = isAdmin || isSuperAdmin;

  return (
    <div className="space-y-8">
      <BreadcrumbNav
        backHref="/admin"
        backLabel="Back to admin"
        items={[
          { label: "Admin", href: "/admin" },
          { label: organization.name },
        ]}
      />

      {/* Manager Scoped Banner */}
      {isManager && !canAdministerSettings ? (
        <div className="flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-900 dark:text-sky-200">
          <UserCheck className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <p>
            <strong>Manager Scope:</strong> You have operational management
            access to view check-ins, manage visits, and view members.
            Organization settings and member role assignments require an
            Organization Administrator or Owner.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <OrgIcon logo={organization.logo} name={organization.name} size="lg" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
              </h1>
              <RoleBadge role={isSuperAdmin ? "admin" : userRole} />
            </div>
            <p className="text-muted-foreground text-sm">
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/orgs/${orgId}/places`}>Places</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/${orgId}/check-ins`}>Check-ins</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
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
                {canAdministerSettings ? (
                  <JoinRequestActions requestId={request.id} />
                ) : (
                  <span className="text-xs text-muted-foreground self-center italic">
                    Requires Admin approval
                  </span>
                )}
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
        <h2 className="text-sm font-semibold">Members & Roles</h2>
        <MembersList
          organizationId={orgId}
          currentUserId={session.user.id}
          currentUserRole={userRole}
          isSuperAdmin={isSuperAdmin}
          members={members}
          orgTags={orgTags}
          memberTagMap={Object.fromEntries(memberTagMap)}
        />
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

      {/* Settings restricted to Organization Admin / Owner */}
      {canAdministerSettings ? (
        <>
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
            <h2 className="text-sm font-semibold">Manual check-in</h2>
            <p className="text-muted-foreground max-w-prose text-sm">
              Allow members to select an approved place and check in without GPS proximity. Ideal when GPS is unavailable or internet is patchy. Entries are marked as manual.
            </p>
            <div className="rounded-xl border border-border/70 bg-card p-4 flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Allow manual check-ins</p>
                <p className="text-xs text-muted-foreground">
                  Members can manually pick any approved place in this organization to check in.
                </p>
              </div>
              <ManualCheckInSwitch
                organizationId={orgId}
                enabled={settingsRows[0]?.allowManualCheckIn ?? false}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Icon</h2>
            <p className="text-muted-foreground max-w-prose text-sm">
              Preset icon or custom logo representing this organization.
            </p>
            <OrgIconForm
              organizationId={orgId}
              currentLogo={organization.logo}
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
        </>
      ) : null}
    </div>
  );
}
