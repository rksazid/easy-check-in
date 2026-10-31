import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { findNearbyPlacesForUser } from "@/actions/check-in";
import { requireApiAuth } from "@/lib/api-auth";

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = positionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { latitude, longitude, accuracyM } = parsed.data;
  const places = await findNearbyPlacesForUser(authResult.session.user.id, {
    latitude,
    longitude,
    accuracyM: accuracyM ?? null,
  });

  return NextResponse.json({ ok: true, places });
}

