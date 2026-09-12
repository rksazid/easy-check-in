import { describe, expect, it } from "vitest";

import {
  MAX_USABLE_ACCURACY_M,
  NEARBY_BUFFER_M,
  evaluateProximity,
  isSuggestable,
} from "./check-in-rules";

const place = { latitude: 51.5074, longitude: -0.1278, radiusM: 150 };

/** A point due north of the place, offset by an approximate metre distance. */
function pointNorthOf(meters: number) {
  return {
    latitude: place.latitude + meters / 111_320,
    longitude: place.longitude,
  };
}

describe("evaluateProximity", () => {
  it("allows a check-in from inside the radius", () => {
    const result = evaluateProximity(place, pointNorthOf(50), 20);
    expect(result.inside).toBe(true);
    expect(result.canCheckIn).toBe(true);
  });

  it("refuses a check-in from well outside the radius", () => {
    const result = evaluateProximity(place, pointNorthOf(900), 20);
    expect(result.inside).toBe(false);
    expect(result.canCheckIn).toBe(false);
    expect(result.reason).toBe("too_far");
  });

  it("reports the distance it measured", () => {
    const result = evaluateProximity(place, pointNorthOf(300), 20);
    expect(result.distanceM).toBeGreaterThan(280);
    expect(result.distanceM).toBeLessThan(320);
  });

  it("lets a poor-but-usable fix count when the radius is plausibly reached", () => {
    // 200 m away with ±80 m of uncertainty could genuinely be inside 150 m.
    const result = evaluateProximity(place, pointNorthOf(200), 80);
    expect(result.inside).toBe(false);
    expect(result.canCheckIn).toBe(true);
  });

  it("caps how much slack a single reading can buy", () => {
    // Claiming ±5000 m must not wave someone through from 1 km away.
    const result = evaluateProximity(place, pointNorthOf(1000), 5000);
    expect(result.canCheckIn).toBe(false);
  });

  it("refuses a fix too vague to mean anything", () => {
    const result = evaluateProximity(place, pointNorthOf(10), 500);
    expect(result.canCheckIn).toBe(false);
    expect(result.reason).toBe("inaccurate");
  });

  it("treats a missing accuracy reading as no slack rather than infinite slack", () => {
    expect(evaluateProximity(place, pointNorthOf(200), null).canCheckIn).toBe(
      false,
    );
    expect(evaluateProximity(place, pointNorthOf(100), null).canCheckIn).toBe(
      true,
    );
  });

  it("accepts a fix exactly at the accuracy limit", () => {
    const result = evaluateProximity(
      place,
      pointNorthOf(10),
      MAX_USABLE_ACCURACY_M,
    );
    expect(result.canCheckIn).toBe(true);
  });
});

describe("isSuggestable", () => {
  it("offers places within the walk-closer buffer", () => {
    expect(isSuggestable(place.radiusM, place.radiusM + NEARBY_BUFFER_M - 1)).toBe(
      true,
    );
  });

  it("hides places beyond it", () => {
    expect(isSuggestable(place.radiusM, place.radiusM + NEARBY_BUFFER_M + 1)).toBe(
      false,
    );
  });
});
