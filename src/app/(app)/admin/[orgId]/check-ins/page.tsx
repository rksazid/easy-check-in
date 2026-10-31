import { asc, eq } from "drizzle-orm";
import { Camera, ChevronRight } from "lucide-react";
import Link from "next/link";

import { CheckInFilters } from "./check-in-filters";
import { sweepForgottenCheckIns } from "@/actions/check-in";
import { Avatar } from "@/components/avatar";
import { Elapsed } from "@/components/elapsed";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { member, places, user } from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";
import { formatHours } from "@/lib/reports/attendance";
import {
  currentMonth,
  formatMonthLabel,
  monthWindow,
  parseMonthKey,
  recentMonthKeys,
  toMonthKey,
} from "@/lib/reports/month-window";
import { listOrganizationTags } from "@/lib/tags";
import { listOrganizationCheckIns } from "@/lib/visits";

const PAGE_SIZE = 50;

const ENDING_LABEL: Record<string, string> = {
  manual: "Checked out",
  auto_forgot: "Closed automatically",
  admin: "Closed by an admin",
};

export async function generateMetadata({
  params,
}: PageProps<"/admin/[orgId]/check-ins">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);
  return { title: `Check-ins at ${organization.name}` };
}

export default async function CheckInLogPage({
  params,
  searchParams,
}: PageProps<"/admin/[orgId]/check-ins">) {
  const { orgId } = await params;
  const query = await searchParams;
  const { organization } = await requireOrgAdmin(orgId);

  await sweepForgottenCheckIns();

  const asString = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const fallbackMonth = currentMonth(organization.timezone);
  const month = parseMonthKey(asString(query.month) ?? "") ?? fallbackMonth;
  const { startUtc, endUtc } = monthWindow(
    month.year,
    month.month,
    organization.timezone,
  );

  const placeId = asString(query.place) || null;
  const userId = asString(query.person) || null;
  const tagId = asString(query.tag) || null;
  const ending = asString(query.ending) || null;
  const page = Math.max(1, Number(asString(query.page) ?? 1) || 1);

  const [log, orgPlaces, people, orgTags] = await Promise.all([
    listOrganizationCheckIns({
      organizationId: orgId,
      startUtc,
      endUtc,
      placeId,
      userId,
      tagId,
      ending,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db
      .select({ id: places.id, name: places.name })
      .from(places)
      .where(eq(places.organizationId, orgId))
      .orderBy(asc(places.name)),
    db
      .select({ id: user.id, name: user.name })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId))
      .orderBy(asc(user.name)),
    listOrganizationTags(orgId),
  ]);

  const lastPage = Math.max(1, Math.ceil(log.total / PAGE_SIZE));

  function pageHref(next: number) {
    const params = new URLSearchParams({
      month: toMonthKey(month.year, month.month),
    });
    if (placeId) params.set("place", placeId);
    if (userId) params.set("person", userId);
    if (tagId) params.set("tag", tagId);
    if (ending) params.set("ending", ending);
    if (next > 1) params.set("page", String(next));
    return `/admin/${orgId}/check-ins?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/admin/${orgId}`}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to {organization.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Check-ins</h1>
        <p className="text-muted-foreground text-sm">
          Every visit in {formatMonthLabel(toMonthKey(month.year, month.month))}.
          Tap one to see the location readings behind it.
        </p>
      </div>

      <CheckInFilters
        organizationId={orgId}
        months={recentMonthKeys(18, fallbackMonth)}
        places={orgPlaces}
        people={people}
        tags={orgTags}
        selected={{
          month: toMonthKey(month.year, month.month),
          place: placeId,
          person: userId,
          tag: tagId,
          ending,
        }}
      />

      <p className="text-muted-foreground text-sm">
        {log.total === 0
          ? "No visits match these filters."
          : `${log.total} ${log.total === 1 ? "visit" : "visits"}`}
      </p>

      {log.rows.length > 0 ? (
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {log.rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/visits/${row.id}`}
                className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <Avatar name={row.personName} src={row.personImage} />

                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">
                      {row.personName}
                    </span>
                    {row.checkedOutAt === null ? (
                      <Badge>Here now</Badge>
                    ) : null}
                    {row.photoCount > 0 ? (
                      <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                        <Camera className="size-3" />
                        {row.photoCount}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {row.placeName}, <LocalTime value={row.checkedInAt} />
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {row.checkoutReason && ENDING_LABEL[row.checkoutReason]
                      ? ENDING_LABEL[row.checkoutReason]
                      : "Still here"}
                    {row.captures > 0
                      ? `, ${row.captures} ${row.captures === 1 ? "reading" : "readings"}`
                      : ", no readings"}
                  </span>
                </span>

                <span className="readout shrink-0 text-sm">
                  {row.seconds === null ? (
                    <Elapsed since={row.checkedInAt} />
                  ) : (
                    formatHours(row.seconds)
                  )}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {lastPage > 1 ? (
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" disabled={page === 1}>
            <Link href={pageHref(Math.max(1, page - 1))}>Previous</Link>
          </Button>
          <span className="text-muted-foreground readout text-sm">
            {page} of {lastPage}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={page === lastPage}
          >
            <Link href={pageHref(Math.min(lastPage, page + 1))}>Next</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
