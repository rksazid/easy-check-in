import { distanceMeters, type Coordinates } from "./haversine";

/**
 * A fix vaguer than this says almost nothing about where someone is, so it is
 * refused outright rather than used to justify a check-in.
 */
export const MAX_USABLE_ACCURACY_M = 100;

/** How far past the radius a place is still worth showing so people can walk closer. */
export const NEARBY_BUFFER_M = 200;

export type PlaceGeofence = {
  latitude: number;
  longitude: number;
  radiusM: number;
};

export type ProximityVerdict = {
  distanceM: number;
  /** Strictly within the radius the admin drew. */
  inside: boolean;
  canCheckIn: boolean;
  reason: "ok" | "too_far" | "inaccurate";
};

/**
 * Decides whether a reported position justifies checking in here.
 *
 * The radius means what the admin drew, so `inside` is measured against it
 * exactly. Checking in is slightly more forgiving: a reading of "200 m away,
 * ±80 m" genuinely might be inside a 150 m radius, so the device's own stated
 * uncertainty is allowed to close the gap — capped, so that a device claiming
 * ±5 km cannot wave someone through from the next town.
 */
export function evaluateProximity(
  place: PlaceGeofence,
  point: Coordinates,
  accuracyM: number | null | undefined,
): ProximityVerdict {
  const distanceM = distanceMeters(place, point);
  const inside = distanceM <= place.radiusM;

  if (typeof accuracyM === "number" && accuracyM > MAX_USABLE_ACCURACY_M) {
    return { distanceM, inside, canCheckIn: false, reason: "inaccurate" };
  }

  // A missing reading buys no slack; it must not behave like unlimited slack.
  const slack = Math.min(accuracyM ?? 0, MAX_USABLE_ACCURACY_M);
  const canCheckIn = distanceM - slack <= place.radiusM;

  return {
    distanceM,
    inside,
    canCheckIn,
    reason: canCheckIn ? "ok" : "too_far",
  };
}

/** Whether a place is close enough to be worth listing at all. */
export function isSuggestable(radiusM: number, distanceM: number): boolean {
  return distanceM <= radiusM + NEARBY_BUFFER_M;
}
