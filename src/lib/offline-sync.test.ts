import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cacheOfflinePlaces,
  clearOfflineQueue,
  enqueueOfflineEvent,
  getCachedOfflinePlaces,
  getLocalActiveCheckIn,
  getOfflineQueue,
  removeOfflineEvents,
  setLocalActiveCheckIn,
  syncOfflineQueue,
  type QueuedSyncEvent,
} from "./offline-sync";

describe("offline-sync", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    // Mock window on globalThis
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.restoreAllMocks();
  });

  it("manages queued events", () => {
    expect(getOfflineQueue()).toEqual([]);

    const event1: QueuedSyncEvent = {
      id: "ev-1",
      type: "check_in",
      placeId: "p-1",
      placeName: "Test Gym",
      latitude: 10,
      longitude: 20,
      timestamp: new Date().toISOString(),
    };

    const event2: QueuedSyncEvent = {
      id: "ev-2",
      type: "check_out",
      timestamp: new Date().toISOString(),
    };

    enqueueOfflineEvent(event1);
    enqueueOfflineEvent(event2);

    expect(getOfflineQueue()).toHaveLength(2);
    expect(getOfflineQueue()[0].id).toBe("ev-1");
    expect(getOfflineQueue()[1].id).toBe("ev-2");

    removeOfflineEvents(["ev-1"]);
    expect(getOfflineQueue()).toHaveLength(1);
    expect(getOfflineQueue()[0].id).toBe("ev-2");

    clearOfflineQueue();
    expect(getOfflineQueue()).toEqual([]);
  });

  it("persists local active check in state", () => {
    expect(getLocalActiveCheckIn()).toBeNull();

    setLocalActiveCheckIn({
      id: "test-id",
      checkedInAt: new Date().toISOString(),
      placeId: "p-1",
      placeName: "Office",
      placeTypeName: "Workplace",
      placeImageUrl: null,
      organizationName: "Org 1",
      latitude: 23,
      longitude: 90,
      radiusM: 100,
      captureCount: 1,
      isManual: true,
      status: "approved",
      images: [],
    });

    const active = getLocalActiveCheckIn();
    expect(active?.placeName).toBe("Office");
    expect(active?.isManual).toBe(true);

    setLocalActiveCheckIn(null);
    expect(getLocalActiveCheckIn()).toBeNull();
  });

  it("caches places for offline access", () => {
    expect(getCachedOfflinePlaces()).toEqual([]);

    cacheOfflinePlaces([
      {
        id: "p-1",
        name: "HQ",
        organizationId: "org-1",
        organizationName: "Acme",
        typeName: "Office",
        imageUrl: null,
        address: "Main St",
        latitude: 23.7,
        longitude: 90.4,
      },
    ]);

    expect(getCachedOfflinePlaces()).toHaveLength(1);
    expect(getCachedOfflinePlaces()[0].name).toBe("HQ");
  });

  it("syncs queue with server endpoint", async () => {
    const event1: QueuedSyncEvent = {
      id: "ev-1",
      type: "check_in",
      placeId: "p-1",
      isManual: true,
      timestamp: new Date().toISOString(),
    };
    enqueueOfflineEvent(event1);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        syncedCount: 1,
        results: [{ id: "ev-1", type: "check_in", ok: true }],
      }),
    });

    const res = await syncOfflineQueue();
    expect(res.ok).toBe(true);
    expect(res.syncedCount).toBe(1);
    expect(res.remainingCount).toBe(0);
    expect(getOfflineQueue()).toHaveLength(0);
  });
});
