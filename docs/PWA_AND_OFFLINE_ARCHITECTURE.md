# Easy Check-In: PWA & Offline Architecture Blueprint

This document explains how **Easy Check-In** functions as an installable **Progressive Web App (PWA)** on any operating system (Android, iOS, macOS, Windows, Linux) and how to achieve **maximum offline capabilities**.

---

## 1. Cross-Platform PWA Installation

A Progressive Web App allows users to install Easy Check-In directly from the browser onto their home screen or desktop without needing an app store.

### Platform Support Matrix:

| Platform | Supported Browsers | Installation Experience | Standalone Window | Push / Badges |
| :--- | :--- | :--- | :--- | :--- |
| **Android** | Chrome, Edge, Samsung Internet, Brave | Native "Install App" banner / 1-tap prompt | Yes (No browser UI) | Yes |
| **iOS / iPadOS** | Safari (iOS 11.3+), Chrome (iOS 16.4+) | Share Sheet $\rightarrow$ "Add to Home Screen" | Yes (Standalone WebKit) | Yes (Web Push iOS 16.4+) |
| **macOS** | Chrome, Edge, Safari 17+ ("Add to Dock") | Omnibox install button or Safari Dock icon | Yes (Native Mac App Window) | Yes |
| **Windows / Linux** | Chrome, Edge, Brave | Omnibox install icon | Yes (Desktop Window + Taskbar) | Yes |

---

## 2. Web App Manifest Enhancements

The app's manifest is generated at `/manifest.webmanifest` via `src/app/manifest.ts`.

To ensure Google Play / Chrome rich install experience and desktop shortcuts, the manifest includes:
- `name`: "Easy Check-In"
- `short_name`: "Check-In"
- `display`: "standalone"
- `theme_color`: `#0C1F26`
- `background_color`: `#0C1F26`
- Icons: `192x192` and `512x512` standard PNGs, and a `512x512` with `purpose: "maskable"`.
- Apple Touch Icon: `public/apple-icon.png` (180x180) referenced in HTML `<head>`.

### Recommended Additions to `src/app/manifest.ts`:
```ts
shortcuts: [
  {
    name: "Quick Check-in",
    short_name: "Check In",
    description: "Check in to nearest place immediately",
    url: "/?action=check-in",
    icons: [{ src: "/icon-192.png", sizes: "192x192" }],
  },
  {
    name: "My Activity",
    short_name: "Activity",
    description: "View your visits and hours",
    url: "/activity",
    icons: [{ src: "/icon-192.png", sizes: "192x192" }],
  },
]
```

---

## 3. How Offline Operation Works on the Web Platform

A common misconception is that location cannot work offline. On modern mobile phones and tablets:
> [!IMPORTANT]
> **Hardware GPS (GNSS) works completely offline without Cellular or Wi-Fi.**
> In airplane mode with location services enabled, `navigator.geolocation.getCurrentPosition()` will still receive satellite fixes and return real-time latitude, longitude, and accuracy readings!

### What Can Work Completely Offline:
1. **Cold-start App Launch**: The app shell (HTML, CSS, JS, icons) loads instantly from the Service Worker cache without an internet connection.
2. **Reading Places**: Active places and their geofences are cached locally in **IndexedDB**.
3. **Proximity Check**: Client-side Haversine formula evaluates if the current GPS coordinates are inside the place's radius.
4. **Queued Check-in / Out**: Check-in records are saved into IndexedDB with timestamp and coordinates.
5. **Visited Map Tiles**: Previously viewed OpenStreetMap tiles remain visible from Cache Storage.
6. **Background Sync**: Once cellular or Wi-Fi reconnects, queued events are automatically dispatched to `POST /api/v1/check-in/sync`.

---

## 4. Service Worker Caching Architecture

Currently, `public/sw.js` is a placeholder that does not cache anything. To enable offline cold launch and map caching, update `public/sw.js` with the following caching strategies:

### Service Worker Strategy:
- **Static Assets** (`/_next/static/*`, `/icons/*`, CSS, JS): **Cache-First** (immutable hashed assets).
- **Map Tiles** (`https://tile.openstreetmap.org/*`): **Stale-While-Revalidate** with a 50MB LRU limit.
- **HTML Navigation** (`/`, `/activity`, `/profile`): **Network-First with Offline Fallback Shell**.
- **API Requests** (`/api/*`): **Network-Only** (queued by client code if offline).

### Implementation (`public/sw.js`):

```javascript
const CACHE_NAME = 'easy-check-in-v1';
const MAP_CACHE_NAME = 'osm-tiles-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png',
  '/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== MAP_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. OpenStreetMap Tile Caching (Stale-While-Revalidate)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(MAP_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 2. Static Next.js Bundles (Cache-First)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // 3. Page Navigation (Network-First with Cache Fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || (await caches.match('/'));
      })
    );
    return;
  }
});
```

---

## 5. Client-Side Offline Queue (IndexedDB)

In the frontend React application (`src/components/offline-queue.ts`), IndexedDB manages queued offline events:

```typescript
// src/lib/offline-queue.ts
export type QueuedEvent = {
  id: string; // crypto.randomUUID()
  type: 'check_in' | 'store_location' | 'check_out';
  placeId?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number | null;
  timestamp: string; // ISO string
};

const DB_NAME = 'easy_check_in_offline';
const STORE_NAME = 'events_queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOfflineEvent(event: QueuedEvent): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedEvents(): Promise<QueuedEvent[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedEvent(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Syncs all pending items with /api/v1/check-in/sync */
export async function syncOfflineQueue(): Promise<number> {
  const queue = await getQueuedEvents();
  if (queue.length === 0) return 0;

  try {
    const res = await fetch('/api/v1/check-in/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: queue }),
    });

    if (res.ok) {
      const data = await res.json();
      for (const item of data.results) {
        if (item.ok) {
          await removeQueuedEvent(item.id);
        }
      }
      return data.syncedCount;
    }
  } catch (err) {
    // Network still unavailable
  }
  return 0;
}
```

---

## 6. Auto-Sync Triggering

To automatically trigger synchronization when the device reconnects to the network, add an event listener in `src/components/service-worker.tsx`:

```typescript
useEffect(() => {
  async function onOnline() {
    const synced = await syncOfflineQueue();
    if (synced > 0) {
      toast.success(`Synced ${synced} offline check-in event(s)`);
    }
  }

  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}, []);
```

---

## 7. Security & Anti-Spoofing in Offline Mode

1. **Maximum Offline Window**: The server enforces a maximum allowable offline age (48 hours) to prevent back-dated fraudulent claims.
2. **Future Timestamp Defense**: Timestamps cannot be in the future (allowing max 5 minutes for device clock drift).
3. **Partial Unique Index Guard**: The PostgreSQL partial index `check_ins_one_open_per_user` ensures that an offline batch cannot result in multiple overlapping open visits.

