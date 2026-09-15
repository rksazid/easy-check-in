import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { sweepForgottenCheckIns } from "@/actions/check-in";
import { Elapsed } from "@/components/elapsed";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { formatHours } from "@/lib/reports/attendance";
import {
  currentMonth,
  formatMonthLabel,
  monthWindow,
  toMonthKey,
} from "@/lib/reports/month-window";
import { requireSession } from "@/lib/session";
import {
  getMyPlaceBreakdown,
  getMyStatsSince,
  listMyVisits,
} from "@/lib/visits";

export const metadata = { title: "Activity" };

const ENDING_LABEL: Record<string, string> = {
  auto_forgot: "Closed automatically",
  admin: "Closed by an admin",
};

export default async function ActivityPage() {
  const session = await requireSession();
  await sweepForgottenCheckIns();

  // The viewer's own calendar month. Organization reports use the organization's
  // zone instead, so the two can differ by a few hours at the edges.
  const { year, month } = currentMonth();
  const { startUtc } = monthWindow(year, month, "UTC");

  const [stats, breakdown, visits] = await Promise.all([
    getMyStatsSince(startUtc),
    getMyPlaceBreakdown(startUtc),
    listMyVisits(50),
  ]);

  const firstName = session.user.name.split(" ")[0];
  const busiest = breakdown[0];

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Your time in {formatMonthLabel(toMonthKey(year, month))}.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total time" value={formatHours(stats.seconds)} />
        <Stat label="Visits" value={String(stats.visits)} />
        <Stat label="Places" value={String(stats.places)} />
        <Stat label="Longest" value={formatHours(stats.longestSeconds)} />
      </dl>

      {busiest ? (
        <p className="text-muted-foreground text-sm">
          Most of it at <span className="text-foreground">{busiest.placeName}</span>
          , {formatHours(busiest.seconds)} across{" "}
          {busiest.visits === 1 ? "one visit" : `${busiest.visits} visits`}.
        </p>
      ) : null}

      {breakdown.length > 1 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Where your time went</h2>
          <ul className="space-y-2">
            {breakdown.map((place) => {
              const share = stats.seconds
                ? Math.round((place.seconds / stats.seconds) * 100)
                : 0;

              return (
                <li key={place.placeId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{place.placeName}</span>
                    <span className="readout text-muted-foreground shrink-0">
                      {formatHours(place.seconds)}
                    </span>
                  </div>
                  {/* A plain proportion bar; the number beside it is the fact. */}
                  <div
                    className="bg-muted h-1.5 overflow-hidden rounded-full"
                    role="presentation"
                  >
                    <div
                      className="bg-signal h-full rounded-full"
                      style={{ width: `${Math.max(share, 2)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">History</h2>

        {visits.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
            Nothing yet. Your visits show up here once you check in somewhere.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {visits.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/visits/${visit.id}`}
                  className="hover:bg-accent/50 flex min-h-16 items-center gap-3 px-4 py-3 transition-colors"
                >
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {visit.placeName}
                      </span>
                      {visit.checkedOutAt === null ? (
                        <Badge className="shrink-0">Now</Badge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      <LocalTime value={visit.checkedInAt} />
                      {visit.checkoutReason &&
                      ENDING_LABEL[visit.checkoutReason] ? (
                        <>. {ENDING_LABEL[visit.checkoutReason]}</>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm">
                    <Elapsed
                      since={visit.checkedInAt}
                      until={visit.checkedOutAt}
                    />
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
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
