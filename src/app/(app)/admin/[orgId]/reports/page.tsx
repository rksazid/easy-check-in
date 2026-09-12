import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { ReportFilters } from "./report-filters";
import { sweepForgottenCheckIns } from "@/actions/check-in";
import { Avatar } from "@/components/avatar";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { places, placeTypes } from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";
import {
  formatHours,
  getAttendanceReport,
  getPlaceTotals,
} from "@/lib/reports/attendance";
import {
  currentMonth,
  formatMonthLabel,
  parseMonthKey,
  recentMonthKeys,
  toMonthKey,
} from "@/lib/reports/month-window";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[orgId]/reports">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);
  return { title: `Reports · ${organization.name}` };
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

  const filters = {
    organizationId: orgId,
    year: parsedMonth.year,
    month: parsedMonth.month,
    timeZone: organization.timezone,
    placeId,
    placeTypeId,
  };

  const [report, placeTotals, orgPlaces, types] = await Promise.all([
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
  ]);

  const csvHref = `/api/orgs/${orgId}/report.csv?${new URLSearchParams({
    month: toMonthKey(parsedMonth.year, parsedMonth.month),
    ...(placeId ? { place: placeId } : {}),
    ...(placeTypeId ? { type: String(placeTypeId) } : {}),
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
        <Button asChild variant="outline">
          <a href={csvHref} download>
            Download CSV
          </a>
        </Button>
      </div>

      <ReportFilters
        organizationId={orgId}
        months={recentMonthKeys(18, currentMonth(organization.timezone))}
        places={orgPlaces}
        types={types}
        selected={{
          month: toMonthKey(parsedMonth.year, parsedMonth.month),
          place: placeId,
          type: placeTypeId,
        }}
      />

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Total time" value={formatHours(report.totals.seconds)} />
        <Stat label="Visits" value={String(report.totals.visits)} />
        <Stat label="People" value={String(report.totals.people)} />
      </dl>

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
                      "—"
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
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {placeTotals.map((place) => (
              <li
                key={place.placeId}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span>
                  {place.placeName}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {place.typeName}
                  </span>
                </span>
                <span className="readout">
                  {formatHours(place.seconds)} · {place.visits} visits
                </span>
              </li>
            ))}
          </ul>
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
