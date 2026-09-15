import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { member, memberTags, tags } from "@/lib/db/schema";

export type Tag = { id: string; name: string };

export async function listOrganizationTags(
  organizationId: string,
): Promise<Tag[]> {
  return db
    .select({ id: tags.id, name: tags.name })
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
      people: sql<number>`count(${memberTags.memberId})::int`,
    })
    .from(tags)
    .leftJoin(memberTags, eq(memberTags.tagId, tags.id))
    .where(eq(tags.organizationId, organizationId))
    .groupBy(tags.id, tags.name)
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
    })
    .from(memberTags)
    .innerJoin(tags, eq(memberTags.tagId, tags.id))
    .innerJoin(member, eq(memberTags.memberId, member.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(sql`lower(${tags.name})`));

  const byMember = new Map<string, Tag[]>();
  for (const row of rows) {
    const list = byMember.get(row.memberId) ?? [];
    list.push({ id: row.id, name: row.name });
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
