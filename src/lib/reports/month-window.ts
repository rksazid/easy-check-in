export type MonthWindow = {
  /** Inclusive start: local midnight on the 1st, as a UTC instant. */
  startUtc: Date;
  /** Exclusive end: local midnight on the 1st of the next month. */
  endUtc: Date;
};

/**
 * How far the given instant's wall clock in `timeZone` is from UTC, in
 * milliseconds. Derived from Intl rather than a table, so it is correct for any
 * zone the runtime knows, including half-hour offsets and historical rules.
 */
function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asIfUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    // Intl can render midnight as hour 24 in some locales' hour-cycle handling.
    value("hour") % 24,
    value("minute"),
    value("second"),
  );

  return asIfUtc - at.getTime();
}

function isKnownZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The UTC instant at which local midnight of a given calendar day occurs. */
function zonedDayStart(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day, 0, 0, 0);

  // First guess uses the offset at the naive instant; the second corrects it
  // when that guess landed on the other side of a DST change.
  let instant = wallClock - offsetMs(timeZone, new Date(wallClock));
  instant = wallClock - offsetMs(timeZone, new Date(instant));

  return new Date(instant);
}

const zonedMonthStart = (year: number, month: number, timeZone: string) =>
  zonedDayStart(year, month, 1, timeZone);

export type DayWindow = { startUtc: Date; endUtc: Date; day: string };

/**
 * The UTC interval covering the local calendar day that has just finished,
 * which is what a morning digest reports on. Built from the same two-pass
 * conversion as the month boundaries, so it survives DST the same way.
 */
export function previousDayWindow(
  timeZone: string,
  now = new Date(),
): DayWindow {
  const zone = isKnownZone(timeZone) ? timeZone : "UTC";

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [year, month, day] = today.split("-").map(Number);
  const endUtc = zonedDayStart(year, month, day, zone);

  // Step back a calendar day through UTC arithmetic, then re-derive the local
  // date, so month and year boundaries take care of themselves.
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  const startUtc = zonedDayStart(
    previous.getUTCFullYear(),
    previous.getUTCMonth() + 1,
    previous.getUTCDate(),
    zone,
  );

  return {
    startUtc,
    endUtc,
    day: new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(startUtc),
  };
}

/**
 * The UTC interval covering one calendar month as the organization experiences
 * it. Reports are cut on these boundaries so a month means the same thing to
 * everyone in the organization, wherever the viewer happens to be.
 */
export function monthWindow(
  year: number,
  month: number,
  timeZone: string,
): MonthWindow {
  // An unrecognised zone must not take down a report; UTC is the honest default.
  const zone = isKnownZone(timeZone) ? timeZone : "UTC";

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    startUtc: zonedMonthStart(year, month, zone),
    endUtc: zonedMonthStart(nextYear, nextMonth, zone),
  };
}

export function parseMonthKey(
  key: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return { year, month };
}

export function toMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Newest first, for a month picker. */
export function recentMonthKeys(
  count: number,
  from: { year: number; month: number } = currentMonth(),
): string[] {
  const keys: string[] = [];
  let { year, month } = from;

  for (let i = 0; i < count; i++) {
    keys.push(toMonthKey(year, month));
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return keys;
}

export function currentMonth(timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: isKnownZone(timeZone) ? timeZone : "UTC",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return { year: value("year"), month: value("month") };
}

export function formatMonthLabel(key: string) {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, 1)));
}
