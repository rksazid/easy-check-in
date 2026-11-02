"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getOfflineQueue, syncOfflineQueue } from "@/lib/offline-sync";

/**
 * Registers the service worker for PWA offline caching and runs background
 * synchronization whenever network connectivity is restored or the server wakes up.
 */
export function ServiceWorker() {
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for service worker updates periodically
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }

    async function attemptSync(notifySuccess = false) {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (getOfflineQueue().length === 0) return;

      try {
        const result = await syncOfflineQueue();
        if (result.ok && result.syncedCount > 0) {
          if (notifySuccess) {
            toast.success(
              `Synced ${result.syncedCount} offline check-in event${
                result.syncedCount > 1 ? "s" : ""
              } with server`
            );
          }
          router.refresh();
        }
      } catch {
        // Silently retry on next trigger
      }
    }

    // 1. Initial attempt when component mounts
    attemptSync(false);

    // 2. Trigger sync when the browser goes online
    const handleOnline = () => {
      attemptSync(true);
    };
    window.addEventListener("online", handleOnline);

    // 3. Trigger sync when the user switches tabs / wakes up the device
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        attemptSync(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Periodic background retry every 25 seconds if items are queued
    const interval = setInterval(() => {
      if (getOfflineQueue().length > 0) {
        attemptSync(false);
      }
    }, 25_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
