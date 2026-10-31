"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { member, memberTags, tags } from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";

export type ActionResult = { ok: true } | { ok: false; error: string };

const tagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the tag a name.")
    .max(40, "Tag names are at most 40 characters."),
  color: z.string().trim().max(20).optional().default("slate"),
});

function refresh(organizationId: string) {
  revalidatePath(`/admin/${organizationId}`);
  revalidatePath(`/orgs/${organizationId}`);
  revalidatePath(`/admin/${organizationId}/reports`);
}

export async function createTag(
  organizationId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { session } = await requireOrgAdmin(organizationId);

  const parsed = tagSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || "slate",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await db.insert(tags).values({
      organizationId,
      name: parsed.data.name,
      color: parsed.data.color,
      createdBy: session.user.id,
    });
  } catch {
    // The case-insensitive unique index is what rejects a near-duplicate.
    return { ok: false, error: `There is already a tag called ${parsed.data.name}.` };
  }

  refresh(organizationId);
  return { ok: true };
}

export async function updateTag(
  organizationId: string,
  tagId: string,
  name: string,
  color = "slate",
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  const parsed = tagSchema.safeParse({ name, color });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await db
      .update(tags)
      .set({ name: parsed.data.name, color: parsed.data.color })
      // Scoped by organization so a tag id from elsewhere cannot be renamed.
      .where(and(eq(tags.id, tagId), eq(tags.organizationId, organizationId)));
  } catch {
    return { ok: false, error: `There is already a tag called ${parsed.data.name}.` };
  }

  refresh(organizationId);
  return { ok: true };
}

export async function renameTag(
  organizationId: string,
  tagId: string,
  name: string,
): Promise<ActionResult> {
  return updateTag(organizationId, tagId, name);
}

/** Deleting a tag takes it off everyone it was on, by cascade. */
export async function deleteTag(
  organizationId: string,
  tagId: string,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  await db
    .delete(tags)
    .where(and(eq(tags.id, tagId), eq(tags.organizationId, organizationId)));

  refresh(organizationId);
  return { ok: true };
}

/** Replaces the whole set of tags on one membership. */
export async function setMemberTags(
  organizationId: string,
  memberId: string,
  tagIds: string[],
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  // Both sides are checked against this organization, so neither a membership
  // nor a tag from somewhere else can be joined up here.
  const [belongs] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
    )
    .limit(1);

  if (!belongs) return { ok: false, error: "That person is not in this organization." };

  const allowed = tagIds.length
    ? await db
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.organizationId, organizationId),
            inArray(tags.id, tagIds),
          ),
        )
    : [];

  await db.delete(memberTags).where(eq(memberTags.memberId, memberId));

  if (allowed.length) {
    await db
      .insert(memberTags)
      .values(allowed.map((tag) => ({ memberId, tagId: tag.id })));
  }

  refresh(organizationId);
  return { ok: true };
}
