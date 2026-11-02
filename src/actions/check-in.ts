"use server";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import {
  checkInImages,
  checkIns,
  DEFAULT_FORGOT_CHECKOUT_HOURS,
  locationCaptures,
  member,
  organization,
  organizationSettings,
  places,
  placeTypes,
} from "@/lib/db/schema";
import { evaluateProximity, isSuggestable } from "@/lib/geo/check-in-rules";
import { distanceMeters } from "@/lib/geo/haversine";
import { requireOrgAdmin } from "@/lib/org";
import { requireSession } from "@/lib/session";
import { deleteStoredImage, saveUploadedImage } from "@/lib/storage/images";

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
 * reports stay meaningful. Nothing observes the user, and the visit is closed at
 * the cap rather than at "now", so a forgotten check-out cannot inflate a total.
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

export type CheckInImageItem = {
  id: string;
  checkInId: string;
  imageUrl: string;
  caption: string | null;
  createdAt: Date;
};

export type ActiveCheckIn = {
  id: string;
  checkedInAt: Date;
  placeId: string;
  placeName: string;
  placeTypeName: string;
  placeTypeIcon?: string | null;
  placeImageUrl: string | null;
  organizationName: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  captureCount: number;
  isManual: boolean;
  status: "approved" | "rejected";
  images: CheckInImageItem[];
};

export async function getCheckInImages(
  checkInId: string,
): Promise<CheckInImageItem[]> {
  return db
    .select({
      id: checkInImages.id,
      checkInId: checkInImages.checkInId,
      imageUrl: checkInImages.imageUrl,
      caption: checkInImages.caption,
      createdAt: checkInImages.createdAt,
    })
    .from(checkInImages)
    .where(eq(checkInImages.checkInId, checkInId))
    .orderBy(asc(checkInImages.createdAt));
}

export async function getUserActiveCheckIn(
  userId: string,
): Promise<ActiveCheckIn | null> {
  await sweepForgottenCheckIns();

  const [row] = await db
    .select({
      id: checkIns.id,
      checkedInAt: checkIns.checkedInAt,
      isManual: checkIns.isManual,
      status: checkIns.status,
      placeId: places.id,
      placeName: places.name,
      placeTypeName: placeTypes.name,
      placeTypeIcon: placeTypes.icon,
      placeImageUrl: places.imageUrl,
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
      and(eq(checkIns.userId, userId), isNull(checkIns.checkedOutAt)),
    )
    .limit(1);

  if (!row) return null;
  const images = await getCheckInImages(row.id);
  return {
    ...row,
    status: row.status as "approved" | "rejected",
    images,
  };
}

export async function getActiveCheckIn(): Promise<ActiveCheckIn | null> {
  const session = await requireSession();
  return getUserActiveCheckIn(session.user.id);
}

export type NearbyPlace = {
  id: string;
  name: string;
  typeName: string;
  typeIcon?: string | null;
  imageUrl: string | null;
  organizationName: string;
  distanceM: number;
  radiusM: number;
  inside: boolean;
  canCheckIn: boolean;
  reason: "ok" | "too_far" | "inaccurate";
};

/** Active places across every organization the user belongs to, nearest first. */
export async function findNearbyPlacesForUser(
  userId: string,
  position: Position,
): Promise<NearbyPlace[]> {
  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  if (memberships.length === 0) return [];

  const candidates = await db
    .select({
      id: places.id,
      name: places.name,
      typeName: placeTypes.name,
      typeIcon: placeTypes.icon,
      imageUrl: places.imageUrl,
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
        // A place only becomes checkable once an admin has approved it.
        eq(places.status, "approved"),
      ),
    );

  return candidates
    .map((place) => {
      const verdict = evaluateProximity(place, position, position.accuracyM);
      return {
        id: place.id,
        name: place.name,
        typeName: place.typeName,
        typeIcon: place.typeIcon,
        imageUrl: place.imageUrl,
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

export async function findNearbyPlaces(
  position: Position,
): Promise<NearbyPlace[]> {
  const session = await requireSession();
  return findNearbyPlacesForUser(session.user.id, position);
}

export async function checkInUser(
  userId: string,
  placeId: string,
  position: Position,
  checkedInAt?: Date,
): Promise<CheckInResult> {
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
      status: places.status,
    })
    .from(places)
    .innerJoin(
      member,
      and(
        eq(member.organizationId, places.organizationId),
        eq(member.userId, userId),
      ),
    )
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place || !place.isActive || place.status !== "approved") {
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
        userId,
        placeId: place.id,
        organizationId: place.organizationId,
        checkedInAt: checkedInAt ?? new Date(),
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
      createdAt: checkedInAt ?? new Date(),
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

export async function checkIn(
  placeId: string,
  position: Position,
): Promise<CheckInResult> {
  const session = await requireSession();
  return checkInUser(session.user.id, placeId, position);
}

export type ManualCheckInPlace = {
  id: string;
  name: string;
  typeName: string;
  typeIcon?: string | null;
  imageUrl: string | null;
  organizationId: string;
  organizationName: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

/**
 * Places from organizations the user belongs to where manual check-in
 * is currently enabled by an admin.
 */
export async function getManualCheckInPlaces(): Promise<ManualCheckInPlace[]> {
  const session = await requireSession();
  return getManualCheckInPlacesForUser(session.user.id);
}

export async function getManualCheckInPlacesForUser(
  userId: string,
): Promise<ManualCheckInPlace[]> {
  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      typeName: placeTypes.name,
      typeIcon: placeTypes.icon,
      imageUrl: places.imageUrl,
      organizationId: places.organizationId,
      organizationName: organization.name,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
    })
    .from(places)
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(places.organizationId, organization.id))
    .innerJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organization.id),
    )
    .innerJoin(
      member,
      and(
        eq(member.organizationId, places.organizationId),
        eq(member.userId, userId),
      ),
    )
    .where(
      and(
        eq(places.isActive, true),
        eq(places.status, "approved"),
        eq(organizationSettings.allowManualCheckIn, true),
      ),
    )
    .orderBy(asc(organization.name), asc(places.name));

  return rows;
}

/**
 * Creates a manual check-in for a member without GPS proximity checks,
 * provided the organization settings permit it.
 * Accepts an explicit event timestamp for offline playback.
 */
export async function manualCheckInUser(
  userId: string,
  placeId: string,
  eventTime: Date = new Date(),
  _note?: string,
): Promise<CheckInResult> {
  await sweepForgottenCheckIns();

  const [place] = await db
    .select({
      id: places.id,
      organizationId: places.organizationId,
      latitude: places.latitude,
      longitude: places.longitude,
      isActive: places.isActive,
      status: places.status,
      allowManualCheckIn: organizationSettings.allowManualCheckIn,
    })
    .from(places)
    .innerJoin(
      member,
      and(
        eq(member.organizationId, places.organizationId),
        eq(member.userId, userId),
      ),
    )
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, places.organizationId),
    )
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place || !place.isActive || place.status !== "approved") {
    return { ok: false, error: "That place is not available to you." };
  }

  if (!place.allowManualCheckIn) {
    return {
      ok: false,
      error: "Manual check-in is not permitted for this organization.",
    };
  }

  try {
    const [created] = await db
      .insert(checkIns)
      .values({
        userId,
        placeId: place.id,
        organizationId: place.organizationId,
        checkedInAt: eventTime,
        isManual: true,
        status: "approved",
      })
      .returning({ id: checkIns.id });

    await db.insert(locationCaptures).values({
      checkInId: created.id,
      kind: "manual",
      latitude: place.latitude,
      longitude: place.longitude,
      accuracyM: null,
      distanceM: 0,
      inside: true,
      createdAt: eventTime,
    });
  } catch {
    return {
      ok: false,
      error: "You are already checked in somewhere. Check out first.",
    };
  }

  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath(`/admin/${place.organizationId}/check-ins`);
  return { ok: true };
}

/**
 * Creates a manual check-in for the current session user without GPS proximity checks,
 * provided the organization settings permit it.
 */
export async function manualCheckIn(
  placeId: string,
  note?: string,
): Promise<CheckInResult> {
  const session = await requireSession();
  return manualCheckInUser(session.user.id, placeId, new Date(), note);
}

/**
 * Allows an organization admin (or super admin) to approve or reject a manual check-in entry.
 */
export async function decideManualCheckIn(
  checkInId: string,
  status: "approved" | "rejected",
  reason?: string,
): Promise<CheckInResult> {
  const session = await requireSession();

  const [visit] = await db
    .select({
      id: checkIns.id,
      organizationId: checkIns.organizationId,
      isManual: checkIns.isManual,
      status: checkIns.status,
    })
    .from(checkIns)
    .where(eq(checkIns.id, checkInId))
    .limit(1);

  if (!visit) {
    return { ok: false, error: "Check-in not found." };
  }

  await requireOrgAdmin(visit.organizationId);

  await db
    .update(checkIns)
    .set({
      status,
      rejectedBy: status === "rejected" ? session.user.id : null,
      rejectedAt: status === "rejected" ? new Date() : null,
      rejectionReason:
        status === "rejected"
          ? reason?.trim() || "Rejected by administrator"
          : null,
    })
    .where(eq(checkIns.id, checkInId));

  revalidatePath(`/visits/${checkInId}`);
  revalidatePath(`/admin/${visit.organizationId}/check-ins`);
  revalidatePath(`/admin/${visit.organizationId}`);
  revalidatePath("/activity");
  revalidatePath("/");

  return { ok: true };
}

export async function storeLocationForUser(
  userId: string,
  position: Position,
  capturedAt?: Date,
): Promise<CheckInResult> {
  const active = await getUserActiveCheckIn(userId);
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
    createdAt: capturedAt ?? new Date(),
  });

  revalidatePath("/");
  return { ok: true };
}

/** Optional mid-visit proof of presence. Never ends the visit. */
export async function storeLocation(
  position: Position,
): Promise<CheckInResult> {
  const session = await requireSession();
  return storeLocationForUser(session.user.id, position);
}

export async function checkOutUser(
  userId: string,
  position?: Position | null,
  checkedOutAt?: Date,
): Promise<CheckInResult> {
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
      and(eq(checkIns.userId, userId), isNull(checkIns.checkedOutAt)),
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
      createdAt: checkedOutAt ?? new Date(),
    });
  }

  await db
    .update(checkIns)
    .set({
      checkedOutAt: checkedOutAt ?? new Date(),
      checkoutReason: "manual",
    })
    .where(and(eq(checkIns.id, active.id), isNull(checkIns.checkedOutAt)));

  revalidatePath("/");
  return { ok: true };
}

/**
 * Ends the visit. A position is recorded when one is offered, but checking out
 * never depends on it. Someone who has already left, or who declines the
 * permission, still needs to be able to close their visit.
 */
export async function checkOut(
  position?: Position | null,
): Promise<CheckInResult> {
  const session = await requireSession();
  return checkOutUser(session.user.id, position);
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
  isManual: boolean;
  status: string;
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
      isManual: checkIns.isManual,
      status: checkIns.status,
    })
    .from(checkIns)
    .innerJoin(places, eq(checkIns.placeId, places.id))
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(checkIns.organizationId, organization.id))
    .where(eq(checkIns.userId, session.user.id))
    .orderBy(desc(checkIns.checkedInAt))
    .limit(limit);
}

/** Uploads one or more images attached to a check-in. */
export async function uploadCheckInImages(
  checkInId: string,
  formData: FormData,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();

  const [visit] = await db
    .select({
      id: checkIns.id,
      userId: checkIns.userId,
      organizationId: checkIns.organizationId,
    })
    .from(checkIns)
    .where(eq(checkIns.id, checkInId))
    .limit(1);

  if (!visit) {
    return { ok: false, error: "Check-in not found." };
  }

  // Can upload if user owns the check-in or is admin
  if (visit.userId !== session.user.id) {
    const isSuper = session.user.role === "admin";
    if (!isSuper) {
      await requireOrgAdmin(visit.organizationId);
    }
  }

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { ok: false, error: "Please select at least one image to upload." };
  }

  const caption = (formData.get("caption") as string)?.trim() || null;
  let uploadedCount = 0;

  for (const file of files) {
    try {
      const stored = await saveUploadedImage(file, "check-ins");
      await db.insert(checkInImages).values({
        checkInId,
        imageUrl: stored.url,
        caption,
      });
      uploadedCount++;
    } catch (err) {
      return {
        ok: false,
        error: `Uploaded ${uploadedCount} image(s), but failed on '${file.name}': ${(err as Error).message}`,
      };
    }
  }

  revalidatePath("/");
  revalidatePath(`/visits/${checkInId}`);
  revalidatePath("/activity");
  revalidatePath(`/admin/${visit.organizationId}/check-ins`);

  return { ok: true, count: uploadedCount };
}

/** Deletes an image attached to a check-in. */
export async function deleteCheckInImage(
  imageId: string,
): Promise<CheckInResult> {
  const session = await requireSession();

  const [image] = await db
    .select({
      id: checkInImages.id,
      imageUrl: checkInImages.imageUrl,
      checkInId: checkInImages.checkInId,
      userId: checkIns.userId,
      organizationId: checkIns.organizationId,
    })
    .from(checkInImages)
    .innerJoin(checkIns, eq(checkInImages.checkInId, checkIns.id))
    .where(eq(checkInImages.id, imageId))
    .limit(1);

  if (!image) {
    return { ok: false, error: "Image not found." };
  }

  if (image.userId !== session.user.id) {
    const isSuper = session.user.role === "admin";
    if (!isSuper) {
      await requireOrgAdmin(image.organizationId);
    }
  }

  await deleteStoredImage(image.imageUrl);
  await db.delete(checkInImages).where(eq(checkInImages.id, imageId));

  revalidatePath("/");
  revalidatePath(`/visits/${image.checkInId}`);
  revalidatePath("/activity");
  revalidatePath(`/admin/${image.organizationId}/check-ins`);

  return { ok: true };
}
