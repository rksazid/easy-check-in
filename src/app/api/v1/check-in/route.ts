import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkInUser, getUserActiveCheckIn } from "@/actions/check-in";
import { requireApiAuth } from "@/lib/api-auth";

const checkInSchema = z.object({
  placeId: z.string().min(1, "placeId is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  const active = await getUserActiveCheckIn(authResult.session.user.id);
  return NextResponse.json({ ok: true, activeCheckIn: active });
}

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

  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { placeId, latitude, longitude, accuracyM } = parsed.data;
  const result = await checkInUser(
    authResult.session.user.id,
    placeId,
    {
      latitude,
      longitude,
      accuracyM: accuracyM ?? null,
    },
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  const active = await getUserActiveCheckIn(authResult.session.user.id);
  return NextResponse.json({ ok: true, activeCheckIn: active }, { status: 201 });
}

