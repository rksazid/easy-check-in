export type Coordinates = {
  latitude: number;
  longitude: number;
};

/** Mean Earth radius. Good to ~0.5% anywhere, far finer than consumer GPS. */
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in metres. Haversine rather than PostGIS: at the scale
 * of a check-in radius the difference from a geodesic is centimetres, and it
 * keeps the database to plain Postgres.
 */
export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Inclusive of the boundary: standing exactly on the line counts as inside. */
export function isWithin(
  place: Coordinates,
  point: Coordinates,
  radiusM: number,
): boolean {
  return distanceMeters(place, point) <= radiusM;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
