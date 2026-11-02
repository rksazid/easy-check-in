"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { useOffline } from "next/offline";

import { subscribeSyncStatus } from "@/lib/offline-sync";

/**
 * Tells someone the app has lost the network, so a button that sits there
 * spinning reads as waiting rather than broken. Anything they press meanwhile
 * is held and sent when the connection returns.
 */
export function OfflineBanner() {
  const offline = useOffline();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
    });
  }, []);

  if (isSyncing) {
    return (
      <div
        role="status"
        className="bg-primary/10 text-primary border-b border-primary/20 flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
      >
        <RefreshCw aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
        Syncing offline check-in data with server...
      </div>
    );
  }

  if (offline) {
    return (
      <div
        role="status"
        className="bg-caution text-caution-foreground flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
      >
        <WifiOff aria-hidden="true" className="size-4 shrink-0" />
        <span>
          Operating offline.
          {pendingCount > 0
            ? ` ${pendingCount} event${pendingCount > 1 ? "s" : ""} queued for sync.`
            : " Check-ins will sync automatically when back online."}
        </span>
      </div>
    );
  }

  return null;
}
