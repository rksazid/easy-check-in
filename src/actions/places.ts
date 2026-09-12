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
import { requireOrgAdmin } from "@/lib/org";

export type ActionResult =
  | { ok: true; placeId?: string }
  | { ok: false; error: string };

const placeSchema = z.object({
  name: z.string().trim().min(2, "Give the place a name.").max(80),
  placeTypeId: z.coerce.number().int().positive("Choose what kind of place it is."),
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

export async function listPlaceTypes() {
  return db
    .select({ id: placeTypes.id, name: placeTypes.name })
    .from(placeTypes)
    .orderBy(placeTypes.sortOrder);
}

export async function createPlace(
  organizationId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { session } = await requireOrgAdmin(organizationId);
  const parsed = readForm(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [created] = await db
    .insert(places)
    .values({
      organizationId,
      createdBy: session.user.id,
      ...parsed.data,
    })
    .returning({ id: places.id });

  revalidatePath(`/admin/${organizationId}/places`);
  return { ok: true, placeId: created.id };
}

export async function updatePlace(
  organizationId: string,
  placeId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);
  const parsed = readForm(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const updated = await db
    .update(places)
    .set({ ...parsed.data, updatedAt: new Date() })
    // Scoped by organization so a place id from elsewhere cannot be edited.
    .where(and(eq(places.id, placeId), eq(places.organizationId, organizationId)))
    .returning({ id: places.id });

  if (updated.length === 0) {
    return { ok: false, error: "That place no longer exists." };
  }

  revalidatePath(`/admin/${organizationId}/places`);
  return { ok: true, placeId };
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
    .where(and(eq(places.id, placeId), eq(places.organizationId, organizationId)));

  revalidatePath(`/admin/${organizationId}/places`);
  return { ok: true };
}
