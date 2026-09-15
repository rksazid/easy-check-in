"use client";

import dynamic from "next/dynamic";

/** Leaflet reads `window` while loading, so it stays out of the server render. */
export const VisitMap = dynamic(
  () => import("./visit-map").then((mod) => mod.VisitMap),
  {
    ssr: false,
    loading: () => (
      <div className="border-border/70 bg-muted/40 text-muted-foreground flex h-56 items-center justify-center rounded-lg border text-sm">
        Loading map
      </div>
    ),
  },
);
