import { NextResponse } from "next/server";

import type { GeocodeResult } from "@/lib/geocode";
import { getSession } from "@/lib/session";

/**
 * Proxies Photon. The public Nominatim API forbids search-as-you-type, which
 * is the whole point of this box, so Photon does the searching instead.
 *
 * Going through our own route keeps the upstream swappable for a keyed provider
 * later without touching the client, and lets us attach a contact header and
 * cache responses.
 */
const PHOTON_SEARCH = "https://photon.komoot.io/api/";
const PHOTON_REVERSE = "https://photon.komoot.io/reverse";

const USER_AGENT = "easy-check-in (https://github.com/easy-check-in)";
const UPSTREAM_TIMEOUT_MS = 6000;

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
};

/** Photon returns address parts, not a formatted line; assemble a readable one. */
function labelFor(properties: Record<string, string | undefined> = {}) {
  const street = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(" ");

  return (
    [
      properties.name,
      street,
      properties.district,
      properties.city ?? properties.county,
      properties.state,
      properties.country,
    ]
      .filter((part): part is string => Boolean(part))
      // Photon repeats the name as the city for towns and villages.
      .filter((part, index, all) => all.indexOf(part) === index)
      .join(", ")
  );
}

function toResults(payload: unknown): GeocodeResult[] {
  const features = (payload as { features?: PhotonFeature[] })?.features ?? [];

  return features.flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates) return [];
    const [longitude, latitude] = coordinates;
    const label = labelFor(feature.properties);
    if (!label) return [];
    return [{ label, latitude, longitude }];
  });
}

export async function GET(request: Request) {
  // Geocoding is only offered to signed-in users so the proxy cannot be used as
  // an open relay against Photon's fair-use policy.
  if (!(await getSession())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  const lat = params.get("lat");
  const lon = params.get("lon");

  let upstream: string;

  if (lat && lon) {
    upstream = `${PHOTON_REVERSE}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&limit=1`;
  } else if (query && query.length >= 3) {
    upstream = `${PHOTON_SEARCH}?q=${encodeURIComponent(query)}&limit=6`;
  } else {
    return NextResponse.json({ results: [] });
  }

  try {
    const response = await fetch(upstream, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The address lookup service is unavailable." },
        { status: 502 },
      );
    }

    return NextResponse.json({ results: toResults(await response.json()) });
  } catch {
    return NextResponse.json(
      { error: "The address lookup service did not respond." },
      { status: 504 },
    );
  }
}
