import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  checkInUser,
  checkOutUser,
  manualCheckInUser,
  storeLocationForUser,
} from "@/actions/check-in";
import { requireApiAuth } from "@/lib/api-auth";

const syncItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["check_in", "store_location", "check_out"]),
  placeId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().nullable().optional(),
  isManual: z.boolean().optional(),
  timestamp: z.string().datetime({ message: "timestamp must be ISO 8601" }),
});

const syncBatchSchema = z.object({
  events: z.array(syncItemSchema).min(1, "At least one event is required").max(100),
});

const MAX_OFFLINE_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

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

  const parsed = syncBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const results: Array<{
    id?: string;
    type: string;
    ok: boolean;
    error?: string;
  }> = [];

  const now = Date.now();
  const userId = authResult.session.user.id;

  for (const item of parsed.data.events) {
    const eventTime = new Date(item.timestamp);
    const eventTimeMs = eventTime.getTime();

    // Reject future events beyond clock drift (5 minutes) or older than 48 hours
    if (eventTimeMs > now + 5 * 60 * 1000) {
      results.push({
        id: item.id,
        type: item.type,
        ok: false,
        error: "Event timestamp is in the future",
      });
      continue;
    }

    if (now - eventTimeMs > MAX_OFFLINE_AGE_MS) {
      results.push({
        id: item.id,
        type: item.type,
        ok: false,
        error: "Event is too old to sync (exceeds 48 hours)",
      });
      continue;
    }

    if (item.type === "check_in") {
      if (item.isManual) {
        if (!item.placeId) {
          results.push({
            id: item.id,
            type: item.type,
            ok: false,
            error: "manual check_in requires placeId",
          });
          continue;
        }

        const res = await manualCheckInUser(userId, item.placeId, eventTime);
        results.push({ id: item.id, type: item.type, ok: res.ok, error: res.ok ? undefined : res.error });
      } else {
        if (!item.placeId || item.latitude === undefined || item.longitude === undefined) {
          results.push({
            id: item.id,
            type: item.type,
            ok: false,
            error: "check_in requires placeId, latitude, and longitude",
          });
          continue;
        }

        const res = await checkInUser(
          userId,
          item.placeId,
          {
            latitude: item.latitude,
            longitude: item.longitude,
            accuracyM: item.accuracyM ?? null,
          },
          eventTime,
        );
        results.push({ id: item.id, type: item.type, ok: res.ok, error: res.ok ? undefined : res.error });
      }
    } else if (item.type === "store_location") {
      if (item.latitude === undefined || item.longitude === undefined) {
        results.push({
          id: item.id,
          type: item.type,
          ok: false,
          error: "store_location requires latitude and longitude",
        });
        continue;
      }

      const res = await storeLocationForUser(
        userId,
        {
          latitude: item.latitude,
          longitude: item.longitude,
          accuracyM: item.accuracyM ?? null,
        },
        eventTime,
      );
      results.push({ id: item.id, type: item.type, ok: res.ok, error: res.ok ? undefined : res.error });
    } else if (item.type === "check_out") {
      const position =
        item.latitude !== undefined && item.longitude !== undefined
          ? {
              latitude: item.latitude,
              longitude: item.longitude,
              accuracyM: item.accuracyM ?? null,
            }
          : null;

      const res = await checkOutUser(userId, position, eventTime);
      results.push({ id: item.id, type: item.type, ok: res.ok, error: res.ok ? undefined : res.error });
    }
  }

  return NextResponse.json({
    ok: true,
    syncedCount: results.filter((r) => r.ok).length,
    results,
  });
}

