"use server";

import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { places, placeTypes } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAllPlaceTypes() {
  revalidatePath("/sa");
  revalidatePath("/orgs");
  revalidatePath("/");
}

const placeTypeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(50),
  icon: z.string().trim().max(40).optional().default("map-pin"),
  sortOrder: z.coerce.number().int().default(100),
});

export type PlaceTypeAdminItem = {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  placeCount: number;
};

export async function listAllPlaceTypesForAdmin(): Promise<PlaceTypeAdminItem[]> {
  await requireSuperAdmin();

  const rows = await db
    .select({
      id: placeTypes.id,
      name: placeTypes.name,
      icon: placeTypes.icon,
      sortOrder: placeTypes.sortOrder,
      placeCount: sql<number>`count(${places.id})::int`,
    })
    .from(placeTypes)
    .leftJoin(places, eq(places.placeTypeId, placeTypes.id))
    .groupBy(placeTypes.id, placeTypes.name, placeTypes.icon, placeTypes.sortOrder)
    .orderBy(asc(placeTypes.sortOrder), asc(placeTypes.name));

  return rows;
}

export async function createPlaceType(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireSuperAdmin();

  // If sortOrder was not explicitly given, compute max(sortOrder) + 10
  let sortOrderVal = formData.get("sortOrder");
  if (!sortOrderVal) {
    const [maxRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${placeTypes.sortOrder}), 0)::int` })
      .from(placeTypes);
    sortOrderVal = String((maxRow?.maxOrder ?? 0) + 10);
  }

  const parsed = placeTypeSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || "map-pin",
    sortOrder: sortOrderVal,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await db.insert(placeTypes).values({
      name: parsed.data.name,
      icon: parsed.data.icon,
      sortOrder: parsed.data.sortOrder,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { ok: false, error: `A kind of place named "${parsed.data.name}" already exists.` };
    }
    return { ok: false, error: "Could not create this kind of place." };
  }

  revalidateAllPlaceTypes();
  return { ok: true };
}

export async function updatePlaceType(
  id: number,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireSuperAdmin();

  const parsed = placeTypeSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || "map-pin",
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await db
      .update(placeTypes)
      .set({
        name: parsed.data.name,
        icon: parsed.data.icon,
        sortOrder: parsed.data.sortOrder,
      })
      .where(eq(placeTypes.id, id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { ok: false, error: `A kind of place named "${parsed.data.name}" already exists.` };
    }
    return { ok: false, error: "Could not update this kind of place." };
  }

  revalidateAllPlaceTypes();
  return { ok: true };
}

export async function reorderPlaceType(
  id: number,
  direction: "up" | "down",
): Promise<ActionResult> {
  await requireSuperAdmin();

  const all = await db
    .select({ id: placeTypes.id, sortOrder: placeTypes.sortOrder })
    .from(placeTypes)
    .orderBy(asc(placeTypes.sortOrder), asc(placeTypes.id));

  const currentIndex = all.findIndex((item) => item.id === id);
  if (currentIndex === -1) {
    return { ok: false, error: "Place type not found." };
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= all.length) {
    return { ok: true }; // Already at boundary
  }

  const currentItem = all[currentIndex];
  const targetItem = all[targetIndex];

  // If they have identical sortOrders, normalize the whole list with clean step 10
  if (currentItem.sortOrder === targetItem.sortOrder) {
    for (let i = 0; i < all.length; i++) {
      all[i].sortOrder = (i + 1) * 10;
    }
  }

  // Swap their sort orders
  const temp = currentItem.sortOrder;
  currentItem.sortOrder = targetItem.sortOrder;
  targetItem.sortOrder = temp;

  // Persist the swap
  await db
    .update(placeTypes)
    .set({ sortOrder: currentItem.sortOrder })
    .where(eq(placeTypes.id, currentItem.id));

  await db
    .update(placeTypes)
    .set({ sortOrder: targetItem.sortOrder })
    .where(eq(placeTypes.id, targetItem.id));

  revalidateAllPlaceTypes();
  return { ok: true };
}

export async function deletePlaceType(id: number): Promise<ActionResult> {
  await requireSuperAdmin();

  const [inUse] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(places)
    .where(eq(places.placeTypeId, id));

  if (inUse && inUse.count > 0) {
    return {
      ok: false,
      error: `Cannot delete this kind of place because ${inUse.count} ${inUse.count === 1 ? "place is" : "places are"} currently using it.`,
    };
  }

  await db.delete(placeTypes).where(eq(placeTypes.id, id));

  revalidateAllPlaceTypes();
  return { ok: true };
}

