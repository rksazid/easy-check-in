import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/api-auth";
import { db } from "@/lib/db/client";
import { member, organization, places, placeTypes } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  const userId = authResult.session.user.id;

  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  if (memberships.length === 0) {
    return NextResponse.json({ ok: true, places: [] });
  }

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      imageUrl: places.imageUrl,
      latitude: places.latitude,
      longitude: places.longitude,
      radiusM: places.radiusM,
      placeTypeId: places.placeTypeId,
      typeName: placeTypes.name,
      typeIcon: placeTypes.icon,
      organizationId: places.organizationId,
      organizationName: organization.name,
    })
    .from(places)
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .innerJoin(organization, eq(places.organizationId, organization.id))
    .where(
      and(
        inArray(
          places.organizationId,
          memberships.map((m) => m.organizationId),
        ),
        eq(places.isActive, true),
        eq(places.status, "approved"),
      ),
    );

  return NextResponse.json({ ok: true, places: rows });
}

