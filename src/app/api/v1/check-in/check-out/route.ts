import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkOutUser } from "@/actions/check-in";
import { requireApiAuth } from "@/lib/api-auth";

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = checkOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const position =
    parsed.data.latitude !== undefined && parsed.data.longitude !== undefined
      ? {
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          accuracyM: parsed.data.accuracyM ?? null,
        }
      : null;

  const result = await checkOutUser(authResult.session.user.id, position);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, message: "Checked out successfully" });
}

