"use client";

import L from "leaflet";
import { Circle, CircleMarker, MapContainer, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

export type VisitMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  inside: boolean;
};

/**
 * Read-only picture of one visit: the place with its radius, and every position
 * that was recorded during it.
 */
export function VisitMap({
  latitude,
  longitude,
  radiusM,
  points,
}: {
  latitude: number;
  longitude: number;
  radiusM: number;
  points: VisitMapPoint[];
}) {
  const centre: [number, number] = [latitude, longitude];

  // Frame the circle plus any reading taken outside it.
  const bounds = L.latLngBounds([centre])
    .extend(L.latLng(centre).toBounds(radiusM * 2.4))
    .extend(points.map((p) => [p.latitude, p.longitude] as [number, number]));

  return (
    <div className="border-border/70 isolate relative z-0 h-56 overflow-hidden rounded-lg border">
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Circle
          center={centre}
          radius={radiusM}
          pathOptions={{
            color: "var(--signal)",
            fillColor: "var(--signal)",
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={6}
            pathOptions={{
              color: "var(--background)",
              weight: 2,
              fillColor: point.inside ? "var(--signal)" : "var(--caution)",
              fillOpacity: 1,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
