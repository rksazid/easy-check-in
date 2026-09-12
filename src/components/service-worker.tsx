"use client";

import { useEffect } from "react";

/** Registers the worker that makes the app installable. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registration failing only costs installability, never functionality.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
