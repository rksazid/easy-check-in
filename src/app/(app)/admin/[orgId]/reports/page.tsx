import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { ReportFilters } from "./report-filters";
import { sweepForgottenCheckIns } from "@/actions/check-in";
import { Avatar } from "@/components/avatar";
import { BarList } from "@/components/charts/bar-list";
import { ColumnChart } from "@/components/charts/column-chart";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { places, placeTypes } from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";
import { listOrganizationTags } from "@/lib/tags";
import {
  formatHours,
  getAttendanceReport,
  getPlaceTotals,
} from "@/lib/reports/attendance";
import {
  countPeopleSeen,
  dailyTotals,
  getInsights,
} from "@/lib/reports/activity";
import {
  currentMonth,
  formatMonthLabel,
  monthWindow,
  parseMonthKey,
  recentMonthKeys,
  toMonthKey,
} from "@/lib/reports/month-window";
import { listOrganizationMembers } from "@/lib/visits";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[orgId]/reports">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);
  return { title: `Reports for ${organization.name}` };
}

export default async function ReportsPage({
  params,
  searchParams,
}: PageProps<"/admin/[orgId]/reports">) {
  const { orgId } = await params;
  const query = await searchParams;
  const { organization } = await requireOrgAdmin(orgId);

  // Any visit left open past the cap is closed first, so totals are complete.
  await sweepForgottenCheckIns();

  const asString = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const monthKey =
    asString(query.month) ??
    toMonthKey(
      currentMonth(organization.timezone).year,
      currentMonth(organization.timezone).month,
    );
  const parsedMonth =
    parseMonthKey(monthKey) ?? currentMonth(organization.timezone);

  const placeId = asString(query.place) || null;
  const placeTypeId = Number(asString(query.type)) || null;
  const tagId = asString(query.tag) || null;

  const filters = {
    organizationId: orgId,
    year: parsedMonth.year,
    month: parsedMonth.month,
    timeZone: organization.timezone,
    placeId,
    placeTypeId,
    tagId,
  };

  const { startUtc, endUtc } = monthWindow(
    parsedMonth.year,
    parsedMonth.month,
    organization.timezone,
  );
  const scope = {
    organizationId: orgId,
    placeId,
    placeTypeId,
    tagId,
  };

  const [report, placeTotals, orgPlaces, types, orgTags, days, members, seen] =
    await Promise.all([
    getAttendanceReport(filters),
    getPlaceTotals(filters),
    db
      .select({ id: places.id, name: places.name })
      .from(places)
      .where(eq(places.organizationId, orgId))
      .orderBy(asc(places.name)),
    db
      .select({ id: placeTypes.id, name: placeTypes.name })
      .from(placeTypes)
      .orderBy(asc(placeTypes.sortOrder)),
      listOrganizationTags(orgId),
      dailyTotals(scope, startUtc, endUtc, organization.timezone),
      listOrganizationMembers(orgId),
      countPeopleSeen(orgId, startUtc, endUtc),
    ]);

  const insights = await getInsights(
    scope,
    startUtc,
    endUtc,
    organization.timezone,
    days,
  );

  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${day}T00:00:00Z`));

  const csvHref = `/api/orgs/${orgId}/report.csv?${new URLSearchParams({
    month: toMonthKey(parsedMonth.year, parsedMonth.month),
    ...(placeId ? { place: placeId } : {}),
    ...(placeTypeId ? { type: String(placeTypeId) } : {}),
    ...(tagId ? { tag: tagId } : {}),
  }).toString()}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={`/admin/${orgId}`}
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Back to {organization.name}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatMonthLabel(toMonthKey(parsedMonth.year, parsedMonth.month))}
          </h1>
          <p className="text-muted-foreground text-sm">
            Months run midnight to midnight in{" "}
            <span className="readout">{organization.timezone}</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/${orgId}/check-ins?month=${toMonthKey(parsedMonth.year, parsedMonth.month)}`}>
              Every check-in
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={csvHref} download>
              Download CSV
            </a>
          </Button>
        </div>
      </div>

      <ReportFilters
        organizationId={orgId}
        months={recentMonthKeys(18, currentMonth(organization.timezone))}
        places={orgPlaces}
        types={types}
        tags={orgTags}
        selected={{
          month: toMonthKey(parsedMonth.year, parsedMonth.month),
          place: placeId,
          type: placeTypeId,
          tag: tagId,
        }}
      />

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Total time" value={formatHours(report.totals.seconds)} />
        <Stat label="Visits" value={String(report.totals.visits)} />
        <Stat label="People" value={String(report.totals.people)} />
      </dl>

      {report.totals.visits > 0 ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Time by day</h2>
            <ColumnChart
              points={days.map((day) => ({
                key: day.day,
                label: dayLabel(day.day).split(" ")[0],
                value: day.seconds,
                display: formatHours(day.seconds),
                detail: `${day.visits} ${day.visits === 1 ? "visit" : "visits"} on ${dayLabel(day.day)}`,
              }))}
              caption={`Hours recorded each day, ${organization.timezone}`}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">What stands out</h2>
            <ul className="text-muted-foreground space-y-1 text-sm">
              {insights.busiestDay ? (
                <li>
                  Busiest day was{" "}
                  <span className="text-foreground">
                    {dayLabel(insights.busiestDay.day)}
                  </span>
                  , {formatHours(insights.busiestDay.seconds)} across{" "}
                  {insights.busiestDay.visits}{" "}
                  {insights.busiestDay.visits === 1 ? "visit" : "visits"}.
                </li>
              ) : null}
              <li>
                A typical visit ran{" "}
                <span className="text-foreground">
                  {formatHours(insights.averageVisitSeconds)}
                </span>
                , over {insights.activeDays}{" "}
                {insights.activeDays === 1 ? "day" : "days"} with any activity.
              </li>
              {insights.commonestArrivalHour !== null ? (
                <li>
                  People most often arrive around{" "}
                  <span className="text-foreground">
                    {String(insights.commonestArrivalHour).padStart(2, "0")}:00
                  </span>
                  .
                </li>
              ) : null}
              <li>
                <span className="text-foreground">
                  {seen} of {members.length}
                </span>{" "}
                {members.length === 1 ? "person" : "people"} checked in at least
                once.
              </li>
            </ul>
          </section>
        </>
      ) : null}

      {report.members.length === 0 ? (
        <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          No completed visits in this month.
        </p>
      ) : (
        <div className="border-border/70 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Member</th>
                <th className="px-4 py-2 text-right font-medium">Time</th>
                <th className="px-4 py-2 text-right font-medium">Visits</th>
                <th className="px-4 py-2 text-right font-medium">Average</th>
                <th className="px-4 py-2 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-border/70 divide-y">
              {report.members.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar
                        name={row.name}
                        src={row.image}
                        className="size-7 text-[10px]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {row.name}
                        </span>
                        <span className="text-muted-foreground readout block truncate text-xs">
                          {row.email}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="readout px-4 py-2 text-right">
                    {formatHours(row.seconds)}
                  </td>
                  <td className="readout px-4 py-2 text-right">{row.visits}</td>
                  <td className="readout text-muted-foreground px-4 py-2 text-right">
                    {formatHours(Math.round(row.seconds / row.visits))}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-right text-xs">
                    {row.lastOut ? (
                      <LocalTime value={row.lastOut} format="date" />
                    ) : (
                      "None"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {placeTotals.length > 1 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">By place</h2>
          <BarList
            caption="Total time recorded at each place this month"
            items={placeTotals.map((place) => ({
              key: place.placeId,
              label: place.placeName,
              sublabel: place.typeName,
              value: place.seconds,
              display: `${formatHours(place.seconds)}, ${place.visits} ${place.visits === 1 ? "visit" : "visits"}`,
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 rounded-lg border px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="readout mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}
