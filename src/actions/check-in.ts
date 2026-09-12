"use server";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import {
  checkIns,
  DEFAULT_FORGOT_CHECKOUT_HOURS,
  locationCaptures,
  member,
  organization,
  places,
  placeTypes,
} from "@/lib/db/schema";
import { evaluateProximity, isSuggestable } from "@/lib/geo/check-in-rules";
import { distanceMeters } from "@/lib/geo/haversine";
import { requireOrgAdmin } from "@/lib/org";
import { requireSession } from "@/lib/session";

export type Position = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
};

export type CheckInResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Closes visits left open past their organization's cap. This is bookkeeping so
 * reports stay meaningful — nothing observes the user, and the visit is closed
 * at the cap rather than "now" so a forgotten check-out cannot inflate a total.
 *
 * Runs opportunistically on pages that read check-in state, which avoids
 * depending on a scheduler the free hosting tier does not provide.
 */
export async function sweepForgottenCheckIns(): Promise<number> {
  const capHours = sql`make_interval(hours => (
    SELECT COALESCE(max(os.forgot_checkout_hours), ${DEFAULT_FORGOT_CHECKOUT_HOURS})
      FROM organization_settings os
     WHERE os.organization_id = ${checkIns.organizationId}
  ))`;

  const closed = await db
    .update(checkIns)
    .set({
      checkedOutAt: sql`${checkIns.checkedInAt} + ${capHours}`,
      checkoutReason: "auto_forgot",
    })
    .where(
      and(
        isNull(checkIns.checkedOutAt),
        sql`now() >= ${checkIns.checkedInAt} + ${capHours}`,
      ),
    )
    .returning({ id: checkIns.id });

  return closed.length;
}

export type ActiveCheckIn = {
  id: string;
  checkedInAt: Date;
  placeId: string;
  placeName: string;
  placeTypeName: string;
  organizationName: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  captureCount: number;
};

export async function getActiveCheckIn(): Promise<ActiveCheckIn | null> {
  const session = await requireSession();
  await sweepForgottenCheckIns();

  const [row] = await db
    .select({
      id: checkIns.id,
      checkedInAt: checkIns.checkedInAt,
      placeId: places.id,
      placeName: places.name,
      placeTypeName: placeTypes.name,
      organizationName: organization.name,
      latitude: places.latitude,
      longitude: places.longitude,
      radiusM: places.radiusM,
      captureCount: sql<number>`(
        SELECT count(*)::int FROM location_captures lc
         WHERE lc.check_in_id = ${checkIns.id}
      )`,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(checkIns.organizationId, organization.id))
    .where(
      and(eq(checkIns.userId, session.user.id), isNull(checkIns.checkedOutAt)),
    )
    .limit(1);

  return row ?? null;
}

export type NearbyPlace = {
  id: string;
  name: string;
  typeName: string;
  organizationName: string;
  distanceM: number;
  radiusM: number;
  inside: boolean;
  canCheckIn: boolean;
  reason: "ok" | "too_far" | "inaccurate";
};

/** Active places across every organization the user belongs to, nearest first. */
export async function findNearbyPlaces(
  position: Position,
): Promise<NearbyPlace[]> {
  const session = await requireSession();

  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, session.user.id));

  if (memberships.length === 0) return [];

  const candidates = await db
    .select({
      id: places.id,
      name: places.name,
      typeName: placeTypes.name,
      organizationName: organization.name,
      latitude: places.latitude,
      longitude: places.longitude,
      radiusM: places.radiusM,
    })
    .from(places)
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(places.organizationId, organization.id))
    .where(
      and(
        inArray(
          places.organizationId,
          memberships.map((row) => row.organizationId),
        ),
        eq(places.isActive, true),
      ),
    );

  return candidates
    .map((place) => {
      const verdict = evaluateProximity(place, position, position.accuracyM);
      return {
        id: place.id,
        name: place.name,
        typeName: place.typeName,
        organizationName: place.organizationName,
        radiusM: place.radiusM,
        distanceM: verdict.distanceM,
        inside: verdict.inside,
        canCheckIn: verdict.canCheckIn,
        reason: verdict.reason,
      };
    })
    .filter((place) => isSuggestable(place.radiusM, place.distanceM))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export async function checkIn(
  placeId: string,
  position: Position,
): Promise<CheckInResult> {
  const session = await requireSession();
  await sweepForgottenCheckIns();

  // The place must belong to an organization the user is in; joining through
  // `member` is what stops a place id from elsewhere being used.
  const [place] = await db
    .select({
      id: places.id,
      organizationId: places.organizationId,
      latitude: places.latitude,
      longitude: places.longitude,
      radiusM: places.radiusM,
      isActive: places.isActive,
    })
    .from(places)
    .innerJoin(
      member,
      and(
        eq(member.organizationId, places.organizationId),
        eq(member.userId, session.user.id),
      ),
    )
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place || !place.isActive) {
    return { ok: false, error: "That place is not available to you." };
  }

  // Re-measured here; the client's own verdict is never trusted.
  const verdict = evaluateProximity(place, position, position.accuracyM);

  if (verdict.reason === "inaccurate") {
    return {
      ok: false,
      error: `Your location is only accurate to about ${Math.round(position.accuracyM ?? 0)} m. Move outside or into the open and try again.`,
    };
  }

  if (!verdict.canCheckIn) {
    return {
      ok: false,
      error: `You are ${Math.round(verdict.distanceM)} m away, and check-in here needs ${place.radiusM} m.`,
    };
  }

  try {
    const [created] = await db
      .insert(checkIns)
      .values({
        userId: session.user.id,
        placeId: place.id,
        organizationId: place.organizationId,
      })
      .returning({ id: checkIns.id });

    await db.insert(locationCaptures).values({
      checkInId: created.id,
      kind: "check_in",
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyM: position.accuracyM,
      distanceM: verdict.distanceM,
      inside: verdict.inside,
    });
  } catch {
    // The partial unique index is what rejects a second open visit.
    return {
      ok: false,
      error: "You are already checked in somewhere. Check out first.",
    };
  }

  revalidatePath("/");
  return { ok: true };
}

/** Optional mid-visit proof of presence. Never ends the visit. */
export async function storeLocation(
  position: Position,
): Promise<CheckInResult> {
  const active = await getActiveCheckIn();
  if (!active) return { ok: false, error: "You are not checked in." };

  const distanceM = distanceMeters(active, position);

  await db.insert(locationCaptures).values({
    checkInId: active.id,
    kind: "manual",
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyM: position.accuracyM,
    distanceM,
    inside: distanceM <= active.radiusM,
  });

  revalidatePath("/");
  return { ok: true };
}

/**
 * Ends the visit. A position is recorded when one is offered, but checking out
 * never depends on it — someone who has already left, or who declines the
 * permission, must still be able to close their visit.
 */
export async function checkOut(
  position?: Position | null,
): Promise<CheckInResult> {
  const session = await requireSession();

  const [active] = await db
    .select({
      id: checkIns.id,
      latitude: places.latitude,
      longitude: places.longitude,
      radiusM: places.radiusM,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .where(
      and(eq(checkIns.userId, session.user.id), isNull(checkIns.checkedOutAt)),
    )
    .limit(1);

  if (!active) return { ok: false, error: "You are not checked in." };

  if (position) {
    const distanceM = distanceMeters(active, position);
    await db.insert(locationCaptures).values({
      checkInId: active.id,
      kind: "check_out",
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyM: position.accuracyM,
      distanceM,
      inside: distanceM <= active.radiusM,
    });
  }

  await db
    .update(checkIns)
    .set({ checkedOutAt: new Date(), checkoutReason: "manual" })
    .where(and(eq(checkIns.id, active.id), isNull(checkIns.checkedOutAt)));

  revalidatePath("/");
  return { ok: true };
}

/** Lets an admin close a visit a member left open. */
export async function adminCheckOut(
  organizationId: string,
  checkInId: string,
): Promise<CheckInResult> {
  await requireOrgAdmin(organizationId);

  const updated = await db
    .update(checkIns)
    .set({ checkedOutAt: new Date(), checkoutReason: "admin" })
    .where(
      and(
        eq(checkIns.id, checkInId),
        eq(checkIns.organizationId, organizationId),
        isNull(checkIns.checkedOutAt),
      ),
    )
    .returning({ id: checkIns.id });

  if (updated.length === 0) {
    return { ok: false, error: "That visit is already closed." };
  }

  revalidatePath(`/admin/${organizationId}`);
  return { ok: true };
}

export type VisitSummary = {
  id: string;
  placeName: string;
  typeName: string;
  organizationName: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkoutReason: string | null;
};

export async function listMyRecentVisits(limit = 20): Promise<VisitSummary[]> {
  const session = await requireSession();

  return db
    .select({
      id: checkIns.id,
      placeName: places.name,
      typeName: placeTypes.name,
      organizationName: organization.name,
      checkedInAt: checkIns.checkedInAt,
      checkedOutAt: checkIns.checkedOutAt,
      checkoutReason: checkIns.checkoutReason,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(checkIns.organizationId, organization.id))
    .where(eq(checkIns.userId, session.user.id))
    .orderBy(desc(checkIns.checkedInAt))
    .limit(limit);
}
