import { describe, expect, it } from "vitest";

import { distanceMeters, formatDistance, isWithin } from "./haversine";

const LONDON = { latitude: 51.5074, longitude: -0.1278 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(LONDON, LONDON)).toBe(0);
  });

  it("matches the known London–Paris great-circle distance", () => {
    // Published value is ~343.5 km; allow a kilometre either way.
    expect(distanceMeters(LONDON, PARIS)).toBeGreaterThan(342_500);
    expect(distanceMeters(LONDON, PARIS)).toBeLessThan(344_500);
  });

  it("is symmetric", () => {
    expect(distanceMeters(LONDON, PARIS)).toBeCloseTo(
      distanceMeters(PARIS, LONDON),
      6,
    );
  });

  it("treats one degree of latitude as about 111 km", () => {
    const north = { latitude: 52.5074, longitude: -0.1278 };
    expect(distanceMeters(LONDON, north)).toBeGreaterThan(111_000);
    expect(distanceMeters(LONDON, north)).toBeLessThan(111_400);
  });

  it("handles small distances precisely", () => {
    // 0.001 degrees of latitude is ~111 m.
    const nearby = { latitude: 51.5084, longitude: -0.1278 };
    expect(distanceMeters(LONDON, nearby)).toBeGreaterThan(105);
    expect(distanceMeters(LONDON, nearby)).toBeLessThan(117);
  });

  it("copes with the antimeridian", () => {
    const west = { latitude: 0, longitude: 179.9 };
    const east = { latitude: 0, longitude: -179.9 };
    // 0.2 degrees of longitude at the equator is ~22 km, not most of the globe.
    expect(distanceMeters(west, east)).toBeLessThan(23_000);
  });
});

describe("isWithin", () => {
  const place = { latitude: 51.5074, longitude: -0.1278 };

  it("counts a point inside the radius", () => {
    expect(isWithin(place, place, 50)).toBe(true);
  });

  it("rejects a point beyond the radius", () => {
    expect(isWithin(place, PARIS, 150)).toBe(false);
  });

  it("includes the boundary itself", () => {
    const metres = distanceMeters(place, { latitude: 51.5084, longitude: -0.1278 });
    expect(isWithin(place, { latitude: 51.5084, longitude: -0.1278 }, metres)).toBe(
      true,
    );
  });
});

describe("formatDistance", () => {
  it("uses whole metres up close", () => {
    expect(formatDistance(42.4)).toBe("42 m");
  });

  it("switches to kilometres past a thousand metres", () => {
    expect(formatDistance(1500)).toBe("1.5 km");
  });

  it("rounds kilometres to one decimal", () => {
    expect(formatDistance(23_456)).toBe("23.5 km");
  });
});
