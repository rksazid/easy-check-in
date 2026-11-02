/**
 * Service Worker for Easy Check-In PWA
 *
 * Provides offline resilience, instant app shell loading when Vercel free tier is sleeping / cold-starting,
 * and caching of static assets and map tiles.
 */

const CACHE_VERSION = "easy-check-in-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const TILES_CACHE = `${CACHE_VERSION}-tiles`;

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon-32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
];

// Timeout before falling back to cached page when network is slow or sleeping (ms)
const NETWORK_TIMEOUT_MS = 2500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Best-effort precaching; do not reject install if an individual asset fails
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!key.startsWith(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ignore non-http/https requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith("http")) return;

  // 1. OpenStreetMap tiles: Stale-While-Revalidate
  if (url.hostname.includes("tile.openstreetmap.org")) {
    event.respondWith(
      caches.open(TILES_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // 2. Next.js static bundles and app icons: Cache-First
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest");

  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cached || new Response("", { status: 408, statusText: "Offline" });
        }
      })
    );
    return;
  }

  // 3. HTML Navigation requests: Network-First with fast timeout fallback
  // This solves the cold-start delay when Vercel free tier sleeps, or when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const pagesCache = await caches.open(PAGES_CACHE);

        // Create a network fetch with timeout
        const networkPromise = (async () => {
          try {
            const networkResponse = await fetch(request);
            if (networkResponse.ok) {
              pagesCache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (err) {
            return null;
          }
        })();

        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS)
        );

        // Race network against timeout
        const fastResponse = await Promise.race([networkPromise, timeoutPromise]);
        if (fastResponse) return fastResponse;

        // If timed out or network failed, try cached page for this exact URL
        const cachedPage = await pagesCache.match(request);
        if (cachedPage) return cachedPage;

        // Otherwise try cached root app shell
        const staticCache = await caches.open(STATIC_CACHE);
        const rootShell =
          (await pagesCache.match("/")) || (await staticCache.match("/"));
        if (rootShell) return rootShell;

        // As a last resort, wait for network to finish
        const lateResponse = await networkPromise;
        if (lateResponse) return lateResponse;

        return new Response(
          "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Offline - Easy Check-In</title></head><body style='font-family:sans-serif;text-align:center;padding:40px;background:#0C1F26;color:#fff;'><h1>Easy Check-In is Offline</h1><p>Waiting for network connection to restore...</p></body></html>",
          {
            headers: { "Content-Type": "text/html" },
          }
        );
      })()
    );
    return;
  }
});
