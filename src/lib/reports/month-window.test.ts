import { describe, expect, it } from "vitest";

import {
  monthWindow,
  parseMonthKey,
  recentMonthKeys,
  formatMonthLabel,
} from "./month-window";

const iso = (date: Date) => date.toISOString();

describe("monthWindow", () => {
  it("spans a whole month in UTC", () => {
    const window = monthWindow(2026, 1, "UTC");
    expect(iso(window.startUtc)).toBe("2026-01-01T00:00:00.000Z");
    expect(iso(window.endUtc)).toBe("2026-02-01T00:00:00.000Z");
  });

  it("starts at local midnight west of Greenwich", () => {
    expect(iso(monthWindow(2026, 1, "America/New_York").startUtc)).toBe(
      "2026-01-01T05:00:00.000Z",
    );
  });

  it("follows the zone's own summer time", () => {
    // New York is UTC-5 in January and UTC-4 in July.
    expect(iso(monthWindow(2026, 7, "America/New_York").startUtc)).toBe(
      "2026-07-01T04:00:00.000Z",
    );
  });

  it("handles a month that begins before a DST change and ends after it", () => {
    // London: March starts on GMT, April starts on BST.
    const march = monthWindow(2026, 3, "Europe/London");
    expect(iso(march.startUtc)).toBe("2026-03-01T00:00:00.000Z");
    expect(iso(march.endUtc)).toBe("2026-03-31T23:00:00.000Z");
  });

  it("handles zones offset by a half hour", () => {
    expect(iso(monthWindow(2026, 1, "Asia/Kolkata").startUtc)).toBe(
      "2025-12-31T18:30:00.000Z",
    );
  });

  it("handles zones ahead of UTC", () => {
    expect(iso(monthWindow(2026, 1, "Asia/Dhaka").startUtc)).toBe(
      "2025-12-31T18:00:00.000Z",
    );
  });

  it("handles southern-hemisphere summer time", () => {
    expect(iso(monthWindow(2026, 11, "Australia/Sydney").startUtc)).toBe(
      "2026-10-31T13:00:00.000Z",
    );
  });

  it("rolls December into the next January", () => {
    const december = monthWindow(2026, 12, "UTC");
    expect(iso(december.endUtc)).toBe("2027-01-01T00:00:00.000Z");
  });

  it("falls back to UTC for an unknown zone rather than throwing", () => {
    expect(iso(monthWindow(2026, 1, "Mars/Olympus_Mons").startUtc)).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});

describe("parseMonthKey", () => {
  it("reads a YYYY-MM key", () => {
    expect(parseMonthKey("2026-03")).toEqual({ year: 2026, month: 3 });
  });

  it("rejects nonsense", () => {
    expect(parseMonthKey("not-a-month")).toBeNull();
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("2026-00")).toBeNull();
    expect(parseMonthKey("")).toBeNull();
  });
});

describe("recentMonthKeys", () => {
  it("counts back from the given month, newest first", () => {
    expect(recentMonthKeys(3, { year: 2026, month: 2 })).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
  });
});

describe("formatMonthLabel", () => {
  it("renders a readable month", () => {
    expect(formatMonthLabel("2026-03")).toBe("March 2026");
  });
});
