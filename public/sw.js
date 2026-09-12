/*
 * Minimal service worker: its only job is to make the app installable.
 *
 * Nothing is cached deliberately. Every screen reflects live check-in state, and
 * a stale one would be worse than a clear failure — showing someone as checked
 * in when they are not is the exact error this app must not make. The fetch
 * handler exists because some browsers require one before offering to install,
 * and it passes everything straight through to the network.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Deliberately no respondWith: the browser handles the request as normal.
});
