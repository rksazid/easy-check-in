import { and, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { checkIns, places } from "@/lib/db/schema";
import { userIdsWithTag } from "@/lib/tags";

export type DailyTotal = {
  /** Local calendar day as YYYY-MM-DD in the zone the report runs on. */
  day: string;
  seconds: number;
  visits: number;
};

export type ActivityScope = {
  organizationId?: string;
  userId?: string;
  placeId?: string | null;
  placeTypeId?: number | null;
  tagId?: string | null;
};

async function scopeConditions(
  scope: ActivityScope,
  startUtc: Date,
  endUtc: Date,
) {
  const conditions = [
    isNotNull(checkIns.checkedOutAt),
    lt(checkIns.checkedInAt, endUtc),
    gt(checkIns.checkedOutAt, startUtc),
  ];

  if (scope.organizationId) {
    conditions.push(eq(checkIns.organizationId, scope.organizationId));
  }
  if (scope.userId) conditions.push(eq(checkIns.userId, scope.userId));
  if (scope.placeId) conditions.push(eq(checkIns.placeId, scope.placeId));
  if (scope.placeTypeId) {
    conditions.push(eq(places.placeTypeId, scope.placeTypeId));
  }
  if (scope.tagId && scope.organizationId) {
    const userIds = await userIdsWithTag(scope.organizationId, scope.tagId);
    conditions.push(
      userIds.length ? inArray(checkIns.userId, userIds) : sql`false`,
    );
  }

  return conditions;
}

/**
 * Time per calendar day, in the given zone, with empty days filled in.
 * A gap in a bar chart has to mean "nothing happened", so the days have to be
 * present rather than merely absent from the result.
 */
export async function dailyTotals(
  scope: ActivityScope,
  startUtc: Date,
  endUtc: Date,
  timeZone: string,
): Promise<DailyTotal[]> {
  const conditions = await scopeConditions(scope, startUtc, endUtc);

  const rows = await db
    .select({
      day: sql<string>`to_char(
        (${checkIns.checkedInAt} AT TIME ZONE ${timeZone})::date, 'YYYY-MM-DD'
      )`,
      seconds: sql<number>`COALESCE(sum(extract(epoch FROM
        least(${checkIns.checkedOutAt}, ${endUtc.toISOString()}::timestamptz)
        - greatest(${checkIns.checkedInAt}, ${startUtc.toISOString()}::timestamptz)
      )), 0)::bigint`,
      visits: sql<number>`count(*)::int`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .where(and(...conditions))
    // By ordinal, not by repeating the expression: the time zone is a bound
    // parameter, and repeating it binds a second one, so Postgres no longer
    // recognises the two expressions as the same and rejects the grouping.
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const found = new Map(
    rows.map((row) => [
      row.day,
      { seconds: Number(row.seconds), visits: Number(row.visits) },
    ]),
  );

  // Walk the window a day at a time so quiet days are zeroes, not gaps.
  const filled: DailyTotal[] = [];
  const cursor = new Date(startUtc);
  while (cursor < endUtc) {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);

    if (!filled.some((entry) => entry.day === day)) {
      const hit = found.get(day);
      filled.push({
        day,
        seconds: hit?.seconds ?? 0,
        visits: hit?.visits ?? 0,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return filled;
}

export type Insights = {
  busiestDay: DailyTotal | null;
  quietestActiveDay: DailyTotal | null;
  averageVisitSeconds: number;
  activeDays: number;
  /** Local hour people most often arrive at, 0 to 23. */
  commonestArrivalHour: number | null;
};

export async function getInsights(
  scope: ActivityScope,
  startUtc: Date,
  endUtc: Date,
  timeZone: string,
  days: DailyTotal[],
): Promise<Insights> {
  const conditions = await scopeConditions(scope, startUtc, endUtc);

  const [summary] = await db
    .select({
      averageSeconds: sql<number>`COALESCE(avg(extract(epoch FROM
        ${checkIns.checkedOutAt} - ${checkIns.checkedInAt})), 0)::bigint`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .where(and(...conditions));

  // The commonest arrival hour is its own grouped query. Folding it into the
  // summary above would need a correlated subquery for no benefit.
  const [hour] = await db
    .select({
      hour: sql<number>`extract(hour FROM
        (${checkIns.checkedInAt} AT TIME ZONE ${timeZone}))::int`,
      arrivals: sql<number>`count(*)::int`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .where(and(...conditions))
    .groupBy(sql`1`)
    .orderBy(sql`2 DESC`)
    .limit(1);

  const withVisits = days.filter((day) => day.visits > 0);

  return {
    busiestDay:
      withVisits.length === 0
        ? null
        : withVisits.reduce((best, day) =>
            day.seconds > best.seconds ? day : best,
          ),
    quietestActiveDay:
      withVisits.length < 2
        ? null
        : withVisits.reduce((worst, day) =>
            day.seconds < worst.seconds ? day : worst,
          ),
    averageVisitSeconds: Number(summary?.averageSeconds ?? 0),
    activeDays: withVisits.length,
    commonestArrivalHour: hour ? Number(hour.hour) : null,
  };
}

/** Members who checked in at least once in the window. */
export async function countPeopleSeen(
  organizationId: string,
  startUtc: Date,
  endUtc: Date,
) {
  const [row] = await db
    .select({ people: sql<number>`count(DISTINCT ${checkIns.userId})::int` })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.organizationId, organizationId),
        isNotNull(checkIns.checkedOutAt),
        lt(checkIns.checkedInAt, endUtc),
        gt(checkIns.checkedOutAt, startUtc),
      ),
    );

  return Number(row?.people ?? 0);
}
