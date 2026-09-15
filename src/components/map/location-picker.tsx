"use client";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import type { GeocodeResult } from "@/lib/geocode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "leaflet/dist/leaflet.css";

export type PickedLocation = {
  latitude: number;
  longitude: number;
  address: string | null;
};

const SEARCH_DEBOUNCE_MS = 350;
const MIN_SEARCH_LENGTH = 3;

/**
 * Leaflet's default marker points at image files it cannot locate under a
 * bundler, so the pin is drawn inline instead. It also matches the app's mark.
 */
const pinIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<span style="display:block;width:28px;height:28px;border-radius:9999px;
    background:var(--signal);border:3px solid var(--background);
    box-shadow:0 1px 6px rgba(0,0,0,.35)"></span>`,
});

function MapController({
  center,
  onMapClick,
}: {
  center: [number, number];
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => onMapClick(event.latlng.lat, event.latlng.lng),
  });

  const map = useMap();
  const previous = useRef(center);

  useEffect(() => {
    const [lat, lng] = center;
    const [prevLat, prevLng] = previous.current;
    // Only recentre when the value came from outside the map itself, otherwise
    // every drag would fight the user.
    if (lat !== prevLat || lng !== prevLng) {
      previous.current = center;
      map.flyTo(center, Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
  }, [center, map]);

  return null;
}

export function LocationPicker({
  value,
  radiusM,
  onChange,
}: {
  value: PickedLocation;
  radiusM: number;
  onChange: (next: PickedLocation) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  const center = useMemo<[number, number]>(
    () => [value.latitude, value.longitude],
    [value.latitude, value.longitude],
  );

  const lookUpAddress = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const response = await fetch(
          `/api/geocode?lat=${latitude}&lon=${longitude}`,
        );
        const payload = (await response.json()) as { results?: GeocodeResult[] };
        return payload.results?.[0]?.label ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  const moveTo = useCallback(
    async (latitude: number, longitude: number, address?: string | null) => {
      onChange({ latitude, longitude, address: address ?? null });
      if (address === undefined) {
        const found = await lookUpAddress(latitude, longitude);
        onChange({ latitude, longitude, address: found });
      }
    },
    [lookUpAddress, onChange],
  );

  // Debounced search-as-you-type. Photon allows this; Nominatim does not.
  useEffect(() => {
    const query = term.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as {
          results?: GeocodeResult[];
        };
        setResults(payload.results ?? []);
      } catch {
        // An aborted request is a superseded keystroke, not a failure.
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  // Derived rather than cleared in the effect: a short term simply shows nothing.
  const visibleResults =
    term.trim().length >= MIN_SEARCH_LENGTH ? results : [];

  function applyManualCoordinates() {
    setError(null);
    const match = manual
      .trim()
      .match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);

    if (!match) {
      setError(
        "Enter coordinates as latitude, longitude. For example 51.5072, -0.1276",
      );
      return;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);

    if (latitude < -90 || latitude > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (longitude < -180 || longitude > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    setManual("");
    void moveTo(latitude, longitude);
  }

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("This browser cannot report your location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        void moveTo(position.coords.latitude, position.coords.longitude),
      () => setError("Could not read your location. Check browser permissions."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="place-search">Find the place</Label>
        <Input
          id="place-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search an address or place name"
          autoComplete="off"
        />
        {searching ? (
          <p className="text-muted-foreground text-xs">Searching…</p>
        ) : null}
        {visibleResults.length > 0 ? (
          <ul className="border-border/70 divide-border/70 max-h-48 divide-y overflow-auto rounded-lg border">
            {visibleResults.map((result) => (
              <li key={`${result.latitude},${result.longitude},${result.label}`}>
                <button
                  type="button"
                  className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                  onClick={() => {
                    setTerm("");
                    setResults([]);
                    void moveTo(
                      result.latitude,
                      result.longitude,
                      result.label,
                    );
                  }}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="border-border/70 h-72 overflow-hidden rounded-lg border">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom
          className="size-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapController
            center={center}
            onMapClick={(lat, lng) => void moveTo(lat, lng)}
          />
          <Circle
            center={center}
            radius={radiusM}
            pathOptions={{
              color: "var(--signal)",
              fillColor: "var(--signal)",
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
          <Marker
            position={center}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng();
                void moveTo(lat, lng);
              },
            }}
          />
        </MapContainer>
      </div>

      <p className="text-muted-foreground text-xs">
        Click the map or drag the pin to fine-tune. The shaded circle is how
        close someone must be to check in.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1 space-y-2">
          <Label htmlFor="manual-coords">Or paste coordinates</Label>
          <Input
            id="manual-coords"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              applyManualCoordinates();
            }}
            placeholder="51.5072, -0.1276"
            className="readout"
          />
        </div>
        <Button type="button" variant="outline" onClick={applyManualCoordinates}>
          Go
        </Button>
        <Button type="button" variant="outline" onClick={useMyLocation}>
          Use my location
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <p className="text-muted-foreground readout text-xs">
        {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        {value.address ? `, ${value.address}` : ""}
      </p>
    </div>
  );
}
