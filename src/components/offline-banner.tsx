"use client";

import { WifiOff } from "lucide-react";
import { useOffline } from "next/offline";

/**
 * Tells someone the app has lost the network, so a button that sits there
 * spinning reads as waiting rather than broken. Anything they press meanwhile
 * is held and sent when the connection returns.
 */
export function OfflineBanner() {
  const offline = useOffline();

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-caution text-caution-foreground flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      No connection. Anything you tap will be sent when you are back online.
    </div>
  );
}
