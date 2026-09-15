import { and, asc, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  checkIns,
  places,
  placeTypes,
  user as userTable,
} from "@/lib/db/schema";
import { userIdsWithTag } from "@/lib/tags";
import { monthWindow, type MonthWindow } from "./month-window";

export type AttendanceFilters = {
  organizationId: string;
  year: number;
  month: number;
  timeZone: string;
  placeId?: string | null;
  placeTypeId?: number | null;
  /** Narrows the report to people carrying this tag in this organization. */
  tagId?: string | null;
};

export type MemberAttendance = {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  seconds: number;
  visits: number;
  firstIn: Date | null;
  lastOut: Date | null;
};

export type AttendanceReport = {
  window: MonthWindow;
  members: MemberAttendance[];
  totals: { seconds: number; visits: number; people: number };
};

/**
 * Time inside the reporting window, in seconds. A visit that straddles a month
 * boundary is clamped rather than counted twice or dropped, so months always
 * sum to the whole.
 */
function clampedSeconds(startUtc: Date, endUtc: Date) {
  return sql<number>`COALESCE(sum(extract(epoch FROM
    least(${checkIns.checkedOutAt}, ${endUtc.toISOString()}::timestamptz)
    - greatest(${checkIns.checkedInAt}, ${startUtc.toISOString()}::timestamptz)
  )), 0)::bigint`;
}

/**
 * Conditions shared by every figure in a report, so the totals, the table and
 * the per-place strip can never disagree about what was counted.
 */
async function buildConditions(
  filters: AttendanceFilters,
  startUtc: Date,
  endUtc: Date,
) {
  const conditions = [
    eq(checkIns.organizationId, filters.organizationId),
    // Open visits have no measurable duration yet; they are shown separately.
    isNotNull(checkIns.checkedOutAt),
    lt(checkIns.checkedInAt, endUtc),
    gt(checkIns.checkedOutAt, startUtc),
  ];

  if (filters.placeId) {
    conditions.push(eq(checkIns.placeId, filters.placeId));
  }
  if (filters.placeTypeId) {
    conditions.push(eq(places.placeTypeId, filters.placeTypeId));
  }
  if (filters.tagId) {
    const userIds = await userIdsWithTag(filters.organizationId, filters.tagId);
    // Nobody carries the tag, so the report is empty rather than unfiltered.
    conditions.push(
      userIds.length
        ? inArray(checkIns.userId, userIds)
        : sql`false`,
    );
  }

  return conditions;
}

export async function getAttendanceReport(
  filters: AttendanceFilters,
): Promise<AttendanceReport> {
  const window = monthWindow(filters.year, filters.month, filters.timeZone);
  const { startUtc, endUtc } = window;

  const conditions = await buildConditions(filters, startUtc, endUtc);

  const rows = await db
    .select({
      userId: userTable.id,
      name: userTable.name,
      email: userTable.email,
      username: userTable.username,
      image: userTable.image,
      seconds: clampedSeconds(startUtc, endUtc),
      visits: sql<number>`count(*)::int`,
      firstIn: sql<Date | null>`min(${checkIns.checkedInAt})`,
      lastOut: sql<Date | null>`max(${checkIns.checkedOutAt})`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(userTable, eq(checkIns.userId, userTable.id))
    .where(and(...conditions))
    .groupBy(
      userTable.id,
      userTable.name,
      userTable.email,
      userTable.username,
      userTable.image,
    )
    .orderBy(asc(userTable.name));

  const members = rows.map((row) => ({
    ...row,
    // bigint arrives as a string from pg; make it a number once, here.
    seconds: Number(row.seconds),
    firstIn: row.firstIn ? new Date(row.firstIn) : null,
    lastOut: row.lastOut ? new Date(row.lastOut) : null,
  }));

  return {
    window,
    members,
    totals: {
      seconds: members.reduce((sum, row) => sum + row.seconds, 0),
      visits: members.reduce((sum, row) => sum + row.visits, 0),
      people: members.length,
    },
  };
}

/** Per-place totals for the same window, for the summary strip. */
export async function getPlaceTotals(filters: AttendanceFilters) {
  const { startUtc, endUtc } = monthWindow(
    filters.year,
    filters.month,
    filters.timeZone,
  );

  const conditions = await buildConditions(filters, startUtc, endUtc);

  const rows = await db
    .select({
      placeId: places.id,
      placeName: places.name,
      typeName: placeTypes.name,
      seconds: clampedSeconds(startUtc, endUtc),
      visits: sql<number>`count(*)::int`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .where(and(...conditions))
    .groupBy(places.id, places.name, placeTypes.name)
    .orderBy(asc(places.name));

  return rows.map((row) => ({ ...row, seconds: Number(row.seconds) }));
}

export function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
