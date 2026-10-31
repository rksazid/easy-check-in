import { NextRequest, NextResponse } from "next/server";

import {
  getCheckInImages,
  getUserActiveCheckIn,
  uploadCheckInImages,
} from "@/actions/check-in";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data with image files" },
      { status: 400 },
    );
  }

  let checkInId = formData.get("checkInId") as string | null;

  // If checkInId is not explicitly passed, attach to current active check-in
  if (!checkInId) {
    const active = await getUserActiveCheckIn(authResult.session.user.id);
    if (!active) {
      return NextResponse.json(
        { ok: false, error: "No active check-in found and no checkInId provided" },
        { status: 422 },
      );
    }
    checkInId = active.id;
  }

  const result = await uploadCheckInImages(checkInId, formData);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 422 },
    );
  }

  const updatedImages = await getCheckInImages(checkInId);

  return NextResponse.json(
    {
      ok: true,
      count: result.count,
      images: updatedImages,
    },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  const { searchParams } = new URL(req.url);
  let checkInId = searchParams.get("checkInId");

  if (!checkInId) {
    const active = await getUserActiveCheckIn(authResult.session.user.id);
    if (!active) {
      return NextResponse.json({ ok: true, images: [] });
    }
    checkInId = active.id;
  }

  const images = await getCheckInImages(checkInId);
  return NextResponse.json({ ok: true, images });
}

