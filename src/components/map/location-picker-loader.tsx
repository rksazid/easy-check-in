"use client";

import dynamic from "next/dynamic";

export type { PickedLocation } from "./location-picker";

/**
 * Leaflet touches `window` while its module is evaluated, so the picker must
 * never be part of a server render.
 */
export const LocationPicker = dynamic(
  () => import("./location-picker").then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="border-border/70 bg-muted/40 text-muted-foreground flex h-72 items-center justify-center rounded-lg border text-sm">
        Loading map…
      </div>
    ),
  },
);
