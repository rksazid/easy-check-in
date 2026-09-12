"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db/client";
import {
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  places,
  placeTypes,
} from "@/lib/db/schema";
import { requireMembership, requireOrgAdmin } from "@/lib/org";

export type ActionResult =
  | { ok: true; placeId?: string; status?: string }
  | { ok: false; error: string };

const placeSchema = z.object({
  name: z.string().trim().min(2, "Give the place a name.").max(80),
  placeTypeId: z.coerce
    .number()
    .int()
    .positive("Choose what kind of place it is."),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce
    .number()
    .int()
    .min(MIN_RADIUS_M, `The radius must be at least ${MIN_RADIUS_M} m.`)
    .max(MAX_RADIUS_M, `The radius must be at most ${MAX_RADIUS_M} m.`),
  address: z.string().trim().max(300).optional().nullable(),
});

function readForm(formData: FormData) {
  return placeSchema.safeParse({
    name: formData.get("name"),
    placeTypeId: formData.get("placeTypeId"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    radiusM: formData.get("radiusM"),
    address: formData.get("address") || null,
  });
}

function revalidatePlaces(organizationId: string) {
  revalidatePath(`/orgs/${organizationId}/places`);
  revalidatePath(`/admin/${organizationId}`);
  revalidatePath("/");
}

export async function listPlaceTypes() {
  return db
    .select({ id: placeTypes.id, name: placeTypes.name })
    .from(placeTypes)
    .orderBy(placeTypes.sortOrder);
}

/**
 * Any member may add a place. One an admin adds is approved on the spot, since
 * requiring them to approve their own proposal would be ceremony; anyone else's
 * waits for a decision before it can be checked in to.
 */
export async function createPlace(
  organizationId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { session, isAdmin } = await requireMembership(organizationId);
  const parsed = readForm(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [created] = await db
    .insert(places)
    .values({
      organizationId,
      createdBy: session.user.id,
      status: isAdmin ? "approved" : "pending",
      reviewedBy: isAdmin ? session.user.id : null,
      reviewedAt: isAdmin ? new Date() : null,
      ...parsed.data,
    })
    .returning({ id: places.id, status: places.status });

  revalidatePlaces(organizationId);
  return { ok: true, placeId: created.id, status: created.status };
}

/**
 * Admins may edit any place. A member may still correct their own proposal
 * while it is waiting, but not after it has been decided.
 */
export async function updatePlace(
  organizationId: string,
  placeId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { session, isAdmin } = await requireMembership(organizationId);
  const parsed = readForm(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [existing] = await db
    .select({ createdBy: places.createdBy, status: places.status })
    .from(places)
    .where(
      and(eq(places.id, placeId), eq(places.organizationId, organizationId)),
    )
    .limit(1);

  if (!existing) return { ok: false, error: "That place no longer exists." };

  const ownPendingProposal =
    existing.createdBy === session.user.id && existing.status === "pending";

  if (!isAdmin && !ownPendingProposal) {
    return {
      ok: false,
      error: "Only an admin can change a place once it has been reviewed.",
    };
  }

  await db
    .update(places)
    .set({ ...parsed.data, updatedAt: new Date() })
    // Scoped by organization so a place id from elsewhere cannot be edited.
    .where(
      and(eq(places.id, placeId), eq(places.organizationId, organizationId)),
    );

  revalidatePlaces(organizationId);
  return { ok: true, placeId };
}

/** An admin decides whether a proposed place counts. */
export async function reviewPlace(
  organizationId: string,
  placeId: string,
  approve: boolean,
): Promise<ActionResult> {
  const { session } = await requireOrgAdmin(organizationId);

  const reviewed = await db
    .update(places)
    .set({
      status: approve ? "approved" : "rejected",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(places.id, placeId),
        eq(places.organizationId, organizationId),
        eq(places.status, "pending"),
      ),
    )
    .returning({ id: places.id });

  if (reviewed.length === 0) {
    return { ok: false, error: "That place has already been reviewed." };
  }

  revalidatePlaces(organizationId);
  return { ok: true };
}

/** A member may withdraw their own proposal while it is still waiting. */
export async function withdrawPlace(
  organizationId: string,
  placeId: string,
): Promise<ActionResult> {
  const { session } = await requireMembership(organizationId);

  const removed = await db
    .delete(places)
    .where(
      and(
        eq(places.id, placeId),
        eq(places.organizationId, organizationId),
        eq(places.createdBy, session.user.id),
        eq(places.status, "pending"),
      ),
    )
    .returning({ id: places.id });

  if (removed.length === 0) {
    return { ok: false, error: "That proposal can no longer be withdrawn." };
  }

  revalidatePlaces(organizationId);
  return { ok: true };
}

/**
 * Places are archived rather than deleted: check-in history references them and
 * must stay readable in reports.
 */
export async function setPlaceActive(
  organizationId: string,
  placeId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  await db
    .update(places)
    .set({ isActive, updatedAt: new Date() })
    .where(
      and(eq(places.id, placeId), eq(places.organizationId, organizationId)),
    );

  revalidatePlaces(organizationId);
  return { ok: true };
}
