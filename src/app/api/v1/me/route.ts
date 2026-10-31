import { NextRequest, NextResponse } from "next/server";

import { getUserActiveCheckIn } from "@/actions/check-in";
import { requireApiAuth } from "@/lib/api-auth";
import { listMyOrganizations } from "@/lib/org";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAuth(req);
  if (authResult.errorResponse) return authResult.errorResponse;

  const { session } = authResult;
  const [organizations, activeCheckIn] = await Promise.all([
    listMyOrganizations(session.user.id),
    getUserActiveCheckIn(session.user.id),
  ]);

  return NextResponse.json({
    ok: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      username: (session.user as { username?: string }).username ?? null,
      image: session.user.image ?? null,
      role: session.user.role ?? null,
    },
    organizations,
    activeCheckIn,
  });
}

