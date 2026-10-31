"use server";

import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import {
  checkIns,
  member,
  organization,
  places,
  user as userTable,
} from "@/lib/db/schema";
import { isSuperAdmin, requireSuperAdmin } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type PlatformUserItem = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  createdAt: Date;
  isSuperAdmin: boolean;
  memberships: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationLogo: string | null;
    role: string;
  }[];
};

export type PlatformStats = {
  totalUsers: number;
  superAdminsCount: number;
  totalOrganizations: number;
  totalPlaces: number;
  todayCheckInsCount: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  await requireSuperAdmin();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    usersCountRow,
    superAdminsCountRow,
    orgsCountRow,
    placesCountRow,
    todayCheckInsRow,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(userTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userTable)
      .where(ilike(userTable.role, "%admin%")),
    db.select({ count: sql<number>`count(*)::int` }).from(organization),
    db.select({ count: sql<number>`count(*)::int` }).from(places),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(checkIns)
      .where(gte(checkIns.checkedInAt, startOfDay)),
  ]);

  return {
    totalUsers: usersCountRow[0]?.count ?? 0,
    superAdminsCount: superAdminsCountRow[0]?.count ?? 0,
    totalOrganizations: orgsCountRow[0]?.count ?? 0,
    totalPlaces: placesCountRow[0]?.count ?? 0,
    todayCheckInsCount: todayCheckInsRow[0]?.count ?? 0,
  };
}

export async function listAllPlatformUsers(params?: {
  search?: string;
  roleFilter?: "all" | "admin" | "user" | "banned";
}): Promise<PlatformUserItem[]> {
  await requireSuperAdmin();

  const search = params?.search?.trim();
  const roleFilter = params?.roleFilter ?? "all";

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(userTable.name, `%${search}%`),
        ilike(userTable.email, `%${search}%`),
        ilike(userTable.username, `%${search}%`),
      ),
    );
  }

  if (roleFilter === "admin") {
    conditions.push(ilike(userTable.role, "%admin%"));
  } else if (roleFilter === "user") {
    conditions.push(
      or(isNull(userTable.role), sql`${userTable.role} NOT ILIKE '%admin%'`),
    );
  } else if (roleFilter === "banned") {
    conditions.push(eq(userTable.banned, true));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      username: userTable.username,
      image: userTable.image,
      role: userTable.role,
      banned: userTable.banned,
      banReason: userTable.banReason,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(whereClause)
    .orderBy(desc(userTable.createdAt))
    .limit(100);

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  const memberships = await db
    .select({
      userId: member.userId,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      organizationLogo: organization.logo,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(inArray(member.userId, userIds))
    .orderBy(organization.name);

  const membershipMap = new Map<
    string,
    {
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      organizationLogo: string | null;
      role: string;
    }[]
  >();

  for (const m of memberships) {
    const list = membershipMap.get(m.userId) ?? [];
    list.push({
      organizationId: m.organizationId,
      organizationName: m.organizationName,
      organizationSlug: m.organizationSlug,
      organizationLogo: m.organizationLogo,
      role: m.role,
    });
    membershipMap.set(m.userId, list);
  }

  return users.map((u) => ({
    ...u,
    isSuperAdmin: isSuperAdmin(u),
    memberships: membershipMap.get(u.id) ?? [],
  }));
}

export async function toggleSuperAdminRole(
  targetUserId: string,
  makeAdmin: boolean,
): Promise<ActionResult> {
  const session = await requireSuperAdmin();

  if (targetUserId === session.user.id && !makeAdmin) {
    return {
      ok: false,
      error: "You cannot revoke your own Super Admin role.",
    };
  }

  try {
    await db
      .update(userTable)
      .set({ role: makeAdmin ? "admin" : "user" })
      .where(eq(userTable.id, targetUserId));
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not change super admin role.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/sa");
  return { ok: true };
}

export async function toggleUserBan(
  targetUserId: string,
  banned: boolean,
  reason?: string,
): Promise<ActionResult> {
  const session = await requireSuperAdmin();

  if (targetUserId === session.user.id) {
    return {
      ok: false,
      error: "You cannot ban your own account.",
    };
  }

  try {
    await db
      .update(userTable)
      .set({
        banned,
        banReason: banned
          ? reason?.trim() || "Suspended by Platform Administrator"
          : null,
      })
      .where(eq(userTable.id, targetUserId));
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not update user status.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/sa");
  return { ok: true };
}

