"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { gravatarUrl, hasGravatar } from "@/lib/avatar";
import { db } from "@/lib/db/client";
import { user as userTable } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { deleteStoredImage, saveUploadedImage, storageKeyFor } from "@/lib/storage/images";

export type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  username: z
    .string()
    .trim()
    .min(3, "Usernames are at least 3 characters.")
    .max(30, "Usernames are at most 30 characters.")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Use only letters, numbers, dots, dashes and underscores.",
    ),
});

export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireSession();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await auth.api.updateUser({
      body: parsed.data,
      headers: await headers(),
    });
  } catch (error) {
    // The username plugin rejects duplicates here rather than at validation time.
    const message =
      error instanceof Error ? error.message : "Could not save your profile.";
    return { ok: false, error: message };
  }

  revalidatePath("/profile");
  return { ok: true };
}

/** Adopts the person's Gravatar, if they have one for their sign-in address. */
export async function adoptGravatar(): Promise<ActionResult> {
  const session = await requireSession();

  if (!(await hasGravatar(session.user.email))) {
    return {
      ok: false,
      error:
        "No Gravatar exists for this email address. Create one at gravatar.com, or upload a photo instead.",
    };
  }

  await db
    .update(userTable)
    .set({
      image: gravatarUrl(session.user.email, { size: 400 }),
      avatarSource: "gravatar",
    })
    .where(eq(userTable.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true };
}

const MAX_AVATAR_BYTES = 500 * 1024; // 500 KB limit
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function uploadAvatar(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload." };
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Upload a JPEG, PNG, WebP or GIF image." };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Images must be 500 KB or smaller." };
  }

  const previous = await db.query.user.findFirst({
    where: eq(userTable.id, session.user.id),
    columns: { image: true, avatarSource: true },
  });

  try {
    const stored = await saveUploadedImage(file, "avatars", session.user.id);

    await db
      .update(userTable)
      .set({ image: stored.url, avatarSource: "upload" })
      .where(eq(userTable.id, session.user.id));

    if (previous?.avatarSource === "upload" && previous.image) {
      await deleteStoredImage(previous.image);
    }
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message || "Could not save uploaded photo.",
    };
  }

  revalidatePath("/profile");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const session = await requireSession();

  const current = await db.query.user.findFirst({
    where: eq(userTable.id, session.user.id),
    columns: { image: true, avatarSource: true },
  });

  // Only uploads occupy storage we pay for; a Gravatar URL is just a pointer.
  if (current?.avatarSource === "upload" && current.image) {
    await deleteStoredImage(current.image);
  }

  await db
    .update(userTable)
    .set({ image: null, avatarSource: "initials" })
    .where(eq(userTable.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true };
}
