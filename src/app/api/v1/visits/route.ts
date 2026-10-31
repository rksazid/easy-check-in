import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/api-auth";
import { listUserVisits } from "@/lib/visits";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100) : 50;

  const visits = await listUserVisits(authResult.session.user.id, limit);

  return NextResponse.json({ ok: true, visits });
}

