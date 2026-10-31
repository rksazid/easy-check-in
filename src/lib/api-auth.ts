import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export type ApiSession = typeof auth.$Infer.Session;

/**
 * Resolves the authenticated session for an incoming API Route Handler.
 * Supports:
 * 1. Bearer tokens in the `Authorization: Bearer <token>` header (ideal for Flutter / mobile apps).
 * 2. Session cookies (for web fetch / same-origin calls).
 */
export async function getApiSession(
  req: Request | NextRequest,
): Promise<ApiSession | null> {
  try {
    return (await auth.api.getSession({
      headers: req.headers,
    })) as ApiSession | null;
  } catch {
    return null;
  }
}

/**
 * Ensures the API caller is authenticated.
 * Returns the session and user, or a 401 Unauthorized JSON NextResponse.
 */
export async function requireApiAuth(
  req: Request | NextRequest,
): Promise<
  | { session: ApiSession; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const session = await getApiSession(req);

  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { ok: false, error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 },
      ),
    };
  }

  return { session, errorResponse: null };
}

