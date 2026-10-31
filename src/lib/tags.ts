import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { member, memberTags, tags } from "@/lib/db/schema";

export type Tag = { id: string; name: string; color?: string | null };

export async function listOrganizationTags(
  organizationId: string,
): Promise<Tag[]> {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags)
    .where(eq(tags.organizationId, organizationId))
    .orderBy(asc(sql`lower(${tags.name})`));
}

/** How many people carry each tag, for the management list. */
export async function countTagUse(organizationId: string) {
  const rows = await db
    .select({
      tagId: tags.id,
      name: tags.name,
      color: tags.color,
      people: sql<number>`count(${memberTags.memberId})::int`,
    })
    .from(tags)
    .leftJoin(memberTags, eq(memberTags.tagId, tags.id))
    .where(eq(tags.organizationId, organizationId))
    .groupBy(tags.id, tags.name, tags.color)
    .orderBy(asc(sql`lower(${tags.name})`));

  return rows.map((row) => ({ ...row, people: Number(row.people) }));
}

/** Tags per membership, keyed by member id so a list can look them up cheaply. */
export async function tagsByMember(
  organizationId: string,
): Promise<Map<string, Tag[]>> {
  const rows = await db
    .select({
      memberId: memberTags.memberId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(memberTags)
    .innerJoin(tags, eq(memberTags.tagId, tags.id))
    .innerJoin(member, eq(memberTags.memberId, member.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(sql`lower(${tags.name})`));

  const byMember = new Map<string, Tag[]>();
  for (const row of rows) {
    const list = byMember.get(row.memberId) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    byMember.set(row.memberId, list);
  }
  return byMember;
}

/** User ids carrying a given tag inside one organization, for report filters. */
export async function userIdsWithTag(
  organizationId: string,
  tagId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: member.userId })
    .from(memberTags)
    .innerJoin(member, eq(memberTags.memberId, member.id))
    .where(
      and(
        eq(memberTags.tagId, tagId),
        eq(member.organizationId, organizationId),
      ),
    );

  return [...new Set(rows.map((row) => row.userId))];
}

/**
 * The signed-in person's own tags in each organization they belong to, keyed by
 * organization id. Lets their own lists show what they are labelled as without
 * opening each organization in turn.
 */
export async function myTagsByOrganization(
  userId: string,
): Promise<Map<string, Tag[]>> {
  const rows = await db
    .select({
      organizationId: member.organizationId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(memberTags)
    .innerJoin(member, eq(memberTags.memberId, member.id))
    .innerJoin(tags, eq(memberTags.tagId, tags.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(sql`lower(${tags.name})`));

  const byOrganization = new Map<string, Tag[]>();
  for (const row of rows) {
    const list = byOrganization.get(row.organizationId) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    byOrganization.set(row.organizationId, list);
  }
  return byOrganization;
}
