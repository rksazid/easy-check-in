"use client";

import type { CheckInImageItem, ManualCheckInPlace } from "@/actions/check-in";

export type QueuedSyncEvent = {
  id: string;
  type: "check_in" | "store_location" | "check_out";
  placeId?: string;
  placeName?: string;
  placeTypeName?: string;
  placeTypeIcon?: string | null;
  placeImageUrl?: string | null;
  organizationId?: string;
  organizationName?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number | null;
  isManual?: boolean;
  timestamp: string; // ISO 8601
};

export type LocalActiveCheckIn = {
  id: string;
  checkedInAt: string; // ISO 8601
  placeId: string;
  placeName: string;
  placeTypeName: string;
  placeTypeIcon?: string | null;
  placeImageUrl: string | null;
  organizationName: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  captureCount: number;
  isManual: boolean;
  status: "approved" | "rejected";
  images: CheckInImageItem[];
};

const QUEUE_STORAGE_KEY = "easy_check_in_offline_queue";
const ACTIVE_STORAGE_KEY = "easy_check_in_local_active";
const PLACES_STORAGE_KEY = "easy_check_in_cached_places";
const SYNC_EVENT_NAME = "easy_check_in_sync_change";

let isSyncInProgress = false;

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore quota or private browsing storage errors
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function notifySyncChanged(): void {
  if (typeof window === "undefined") return;
  const count = getOfflineQueue().length;
  window.dispatchEvent(
    new CustomEvent(SYNC_EVENT_NAME, {
      detail: { pendingCount: count, isSyncing: isSyncInProgress },
    })
  );
}

/**
 * Returns all pending offline events waiting to sync with the server.
 */
export function getOfflineQueue(): QueuedSyncEvent[] {
  const raw = safeGetItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Appends an event to the offline queue and notifies active listeners.
 */
export function enqueueOfflineEvent(event: QueuedSyncEvent): void {
  const current = getOfflineQueue();
  // Filter out any duplicate id just in case
  const updated = [...current.filter((e) => e.id !== event.id), event];
  safeSetItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
  notifySyncChanged();
}

/**
 * Removes successfully processed events from the offline queue.
 */
export function removeOfflineEvents(ids: string[]): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const current = getOfflineQueue();
  const updated = current.filter((e) => !idSet.has(e.id));
  safeSetItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
  notifySyncChanged();
}

/**
 * Clears the entire offline sync queue.
 */
export function clearOfflineQueue(): void {
  safeRemoveItem(QUEUE_STORAGE_KEY);
  notifySyncChanged();
}

/**
 * Retrieves the optimistic active check-in stored locally during offline operation.
 */
export function getLocalActiveCheckIn(): LocalActiveCheckIn | null {
  const raw = safeGetItem(ACTIVE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves or clears the optimistic local active check-in.
 */
export function setLocalActiveCheckIn(active: LocalActiveCheckIn | null): void {
  if (active) {
    safeSetItem(ACTIVE_STORAGE_KEY, JSON.stringify(active));
  } else {
    safeRemoveItem(ACTIVE_STORAGE_KEY);
  }
  notifySyncChanged();
}

/**
 * Caches places locally so they can be viewed and chosen when offline.
 */
export function cacheOfflinePlaces(places: ManualCheckInPlace[]): void {
  if (!places || places.length === 0) return;
  safeSetItem(PLACES_STORAGE_KEY, JSON.stringify(places));
}

/**
 * Gets cached places for offline manual check-in when server is unreachable.
 */
export function getCachedOfflinePlaces(): ManualCheckInPlace[] {
  const raw = safeGetItem(PLACES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Synchronizes pending offline events with the server via /api/v1/check-in/sync.
 */
export async function syncOfflineQueue(): Promise<{
  ok: boolean;
  syncedCount: number;
  remainingCount: number;
}> {
  if (isSyncInProgress) {
    return { ok: true, syncedCount: 0, remainingCount: getOfflineQueue().length };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { ok: true, syncedCount: 0, remainingCount: 0 };
  }

  isSyncInProgress = true;
  notifySyncChanged();

  try {
    // Format items for the sync endpoint
    const eventsPayload = queue.map((e) => ({
      id: e.id,
      type: e.type,
      placeId: e.placeId,
      latitude: e.latitude,
      longitude: e.longitude,
      accuracyM: e.accuracyM,
      isManual: e.isManual,
      timestamp: e.timestamp,
    }));

    const res = await fetch("/api/v1/check-in/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: eventsPayload }),
    });

    if (!res.ok) {
      return { ok: false, syncedCount: 0, remainingCount: getOfflineQueue().length };
    }

    const data = await res.json();
    const successfulIds: string[] = [];

    if (Array.isArray(data.results)) {
      for (const item of data.results) {
        if (item.ok && item.id) {
          successfulIds.push(item.id);
        }
      }
    }

    if (successfulIds.length > 0) {
      removeOfflineEvents(successfulIds);
    }

    const remaining = getOfflineQueue().length;
    return {
      ok: true,
      syncedCount: data.syncedCount ?? successfulIds.length,
      remainingCount: remaining,
    };
  } catch {
    // Network still unavailable or server still asleep
    return { ok: false, syncedCount: 0, remainingCount: getOfflineQueue().length };
  } finally {
    isSyncInProgress = false;
    notifySyncChanged();
  }
}

/**
 * Subscribes to changes in pending offline sync items.
 */
export function subscribeSyncStatus(
  callback: (pendingCount: number, isSyncing: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const custom = event as CustomEvent<{
      pendingCount: number;
      isSyncing: boolean;
    }>;
    if (custom.detail) {
      callback(custom.detail.pendingCount, custom.detail.isSyncing);
    } else {
      callback(getOfflineQueue().length, isSyncInProgress);
    }
  };

  window.addEventListener(SYNC_EVENT_NAME, handler);
  // Initial fire
  callback(getOfflineQueue().length, isSyncInProgress);

  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handler);
  };
}
