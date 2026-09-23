import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/client";
import {
  checkIns,
  locationCaptures,
  member,
  organization,
  places,
  placeTypes,
  user,
} from "@/lib/db/schema";
import { isOrgAdminRole } from "@/lib/org";
import { isSuperAdmin, requireSession } from "@/lib/session";

export type VisitListItem = {
  id: string;
  placeName: string;
  typeName: string;
  organizationName: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkoutReason: string | null;
  seconds: number | null;
};

const durationSeconds = sql<
  number | null
>`CASE WHEN ${checkIns.checkedOutAt} IS NULL THEN NULL
       ELSE extract(epoch FROM ${checkIns.checkedOutAt} - ${checkIns.checkedInAt})::int
  END`;

export async function listMyVisits(limit = 50): Promise<VisitListItem[]> {
  const session = await requireSession();

  const rows = await db
    .select({
      id: checkIns.id,
      placeName: places.name,
      typeName: placeTypes.name,
      organizationName: organization.name,
      checkedInAt: checkIns.checkedInAt,
      checkedOutAt: checkIns.checkedOutAt,
      checkoutReason: checkIns.checkoutReason,
      seconds: durationSeconds,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(checkIns.organizationId, organization.id))
    .where(eq(checkIns.userId, session.user.id))
    .orderBy(desc(checkIns.checkedInAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    seconds: row.seconds === null ? null : Number(row.seconds),
  }));
}

export type MyStats = {
  seconds: number;
  visits: number;
  places: number;
  longestSeconds: number;
};

/** Totals since the given instant, used for the "this month" strip. */
export async function getMyStatsSince(since: Date): Promise<MyStats> {
  const session = await requireSession();

  const [row] = await db
    .select({
      seconds: sql<number>`COALESCE(sum(extract(epoch FROM
        ${checkIns.checkedOutAt} - ${checkIns.checkedInAt})), 0)::bigint`,
      visits: sql<number>`count(*)::int`,
      places: sql<number>`count(DISTINCT ${checkIns.placeId})::int`,
      longestSeconds: sql<number>`COALESCE(max(extract(epoch FROM
        ${checkIns.checkedOutAt} - ${checkIns.checkedInAt})), 0)::bigint`,
    })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.userId, session.user.id),
        isNotNull(checkIns.checkedOutAt),
        gte(checkIns.checkedInAt, since),
      ),
    );

  return {
    seconds: Number(row?.seconds ?? 0),
    visits: Number(row?.visits ?? 0),
    places: Number(row?.places ?? 0),
    longestSeconds: Number(row?.longestSeconds ?? 0),
  };
}

/** Where the signed-in person spent their time, most first. */
export async function getMyPlaceBreakdown(since: Date) {
  const session = await requireSession();

  const rows = await db
    .select({
      placeId: places.id,
      placeName: places.name,
      typeName: placeTypes.name,
      seconds: sql<number>`COALESCE(sum(extract(epoch FROM
        ${checkIns.checkedOutAt} - ${checkIns.checkedInAt})), 0)::bigint`,
      visits: sql<number>`count(*)::int`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .where(
      and(
        eq(checkIns.userId, session.user.id),
        isNotNull(checkIns.checkedOutAt),
        gte(checkIns.checkedInAt, since),
      ),
    )
    .groupBy(places.id, places.name, placeTypes.name)
    .orderBy(desc(sql`sum(extract(epoch FROM
      ${checkIns.checkedOutAt} - ${checkIns.checkedInAt}))`));

  return rows.map((row) => ({ ...row, seconds: Number(row.seconds) }));
}

export type VisitDetail = {
  id: string;
  organizationId: string;
  organizationName: string;
  placeName: string;
  typeName: string;
  placeAddress: string | null;
  placeLatitude: number;
  placeLongitude: number;
  radiusM: number;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkoutReason: string | null;
  seconds: number | null;
  personName: string;
  personImage: string | null;
  /** True when the viewer is looking at somebody else's visit as an admin. */
  viewedAsAdmin: boolean;
  captures: {
    id: string;
    kind: string;
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    distanceM: number;
    inside: boolean;
    createdAt: Date;
  }[];
};

/**
 * One visit in full. Readable by the person who made it, and by admins of the
 * organization it belongs to. Anyone else gets a 404, so a visit id reveals
 * nothing about whether it exists.
 */
export async function getVisitDetail(visitId: string): Promise<VisitDetail> {
  const session = await requireSession();

  const [row] = await db
    .select({
      id: checkIns.id,
      userId: checkIns.userId,
      organizationId: checkIns.organizationId,
      organizationName: organization.name,
      placeName: places.name,
      typeName: placeTypes.name,
      placeAddress: places.address,
      placeLatitude: places.latitude,
      placeLongitude: places.longitude,
      radiusM: places.radiusM,
      checkedInAt: checkIns.checkedInAt,
      checkedOutAt: checkIns.checkedOutAt,
      checkoutReason: checkIns.checkoutReason,
      seconds: durationSeconds,
      personName: user.name,
      personImage: user.image,
      viewerRole: sql<string | null>`(
        SELECT m.role FROM member m
         WHERE m.organization_id = ${checkIns.organizationId}
           AND m.user_id = ${session.user.id}
         LIMIT 1
      )`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(checkIns.organizationId, organization.id))
    .innerJoin(user, eq(checkIns.userId, user.id))
    .where(eq(checkIns.id, visitId))
    .limit(1);

  if (!row) notFound();

  const own = row.userId === session.user.id;
  const admin = isSuperAdmin(session.user) || isOrgAdminRole(row.viewerRole);
  if (!own && !admin) notFound();

  const captures = await db
    .select({
      id: locationCaptures.id,
      kind: locationCaptures.kind,
      latitude: locationCaptures.latitude,
      longitude: locationCaptures.longitude,
      accuracyM: locationCaptures.accuracyM,
      distanceM: locationCaptures.distanceM,
      inside: locationCaptures.inside,
      createdAt: locationCaptures.createdAt,
    })
    .from(locationCaptures)
    .where(eq(locationCaptures.checkInId, visitId))
    .orderBy(asc(locationCaptures.createdAt));

  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    placeName: row.placeName,
    typeName: row.typeName,
    placeAddress: row.placeAddress,
    placeLatitude: row.placeLatitude,
    placeLongitude: row.placeLongitude,
    radiusM: row.radiusM,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt,
    checkoutReason: row.checkoutReason,
    seconds: row.seconds === null ? null : Number(row.seconds),
    personName: row.personName,
    personImage: row.personImage,
    viewedAsAdmin: !own && admin,
    captures,
  };
}

/** Members of an organization, for the people list on its page. */
export async function listOrganizationMembers(organizationId: string) {
  return db
    .select({
      memberId: member.id,
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      role: member.role,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(user.name));
}

/** Counts shown on an organization's page. */
export async function getOrganizationSummary(organizationId: string) {
  const [placeCounts] = await db
    .select({
      total: count(),
      open: sql<number>`count(*) FILTER (
        WHERE ${places.status} = 'approved' AND ${places.isActive}
      )::int`,
    })
    .from(places)
    .where(eq(places.organizationId, organizationId));

  const [visitCounts] = await db
    .select({
      hereNow: sql<number>`count(*) FILTER (
        WHERE ${checkIns.checkedOutAt} IS NULL
      )::int`,
      visitsThisWeek: sql<number>`count(*) FILTER (
        WHERE ${checkIns.checkedInAt} >= now() - interval '7 days'
      )::int`,
    })
    .from(checkIns)
    .where(eq(checkIns.organizationId, organizationId));

  return {
    places: Number(placeCounts?.total ?? 0),
    openPlaces: Number(placeCounts?.open ?? 0),
    hereNow: Number(visitCounts?.hereNow ?? 0),
    visitsThisWeek: Number(visitCounts?.visitsThisWeek ?? 0),
  };
}

export type OrgCheckInFilters = {
  organizationId: string;
  startUtc: Date;
  endUtc: Date;
  placeId?: string | null;
  userId?: string | null;
  tagId?: string | null;
  /** "open" narrows to visits still running, otherwise a checkout reason. */
  ending?: string | null;
  limit?: number;
  offset?: number;
};

export type OrgCheckInRow = {
  id: string;
  userId: string;
  personName: string;
  personImage: string | null;
  placeName: string;
  typeName: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkoutReason: string | null;
  seconds: number | null;
  captures: number;
};

/**
 * Every visit in an organization, newest first, for an admin to read through.
 * The report page answers "how much"; this answers "what exactly happened".
 */
export async function listOrganizationCheckIns(
  filters: OrgCheckInFilters,
): Promise<{ rows: OrgCheckInRow[]; total: number }> {
  const { userIdsWithTag } = await import("@/lib/tags");

  const conditions = [
    eq(checkIns.organizationId, filters.organizationId),
    // A visit counts for a window if any part of it falls inside.
    lt(checkIns.checkedInAt, filters.endUtc),
    sql`COALESCE(${checkIns.checkedOutAt}, now()) > ${filters.startUtc.toISOString()}::timestamptz`,
  ];

  if (filters.placeId) conditions.push(eq(checkIns.placeId, filters.placeId));
  if (filters.userId) conditions.push(eq(checkIns.userId, filters.userId));

  if (filters.ending === "open") {
    conditions.push(isNull(checkIns.checkedOutAt));
  } else if (filters.ending) {
    conditions.push(eq(checkIns.checkoutReason, filters.ending));
  }

  if (filters.tagId) {
    const userIds = await userIdsWithTag(filters.organizationId, filters.tagId);
    conditions.push(
      userIds.length ? inArray(checkIns.userId, userIds) : sql`false`,
    );
  }

  const where = and(...conditions);

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(checkIns)
    .where(where);

  const rows = await db
    .select({
      id: checkIns.id,
      userId: checkIns.userId,
      personName: user.name,
      personImage: user.image,
      placeName: places.name,
      typeName: placeTypes.name,
      checkedInAt: checkIns.checkedInAt,
      checkedOutAt: checkIns.checkedOutAt,
      checkoutReason: checkIns.checkoutReason,
      seconds: durationSeconds,
      captures: sql<number>`(
        SELECT count(*)::int FROM location_captures lc
         WHERE lc.check_in_id = ${checkIns.id}
      )`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(user, eq(checkIns.userId, user.id))
    .where(where)
    .orderBy(desc(checkIns.checkedInAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return {
    total: Number(counted?.total ?? 0),
    rows: rows.map((row) => ({
      ...row,
      seconds: row.seconds === null ? null : Number(row.seconds),
      captures: Number(row.captures),
    })),
  };
}
