"use client";

import { useSyncExternalStore } from "react";

const FORMATS = {
  date: { dateStyle: "medium" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
  time: { timeStyle: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const subscribe = () => () => {};

/**
 * Timestamps are stored in UTC and must read in the viewer's own zone. The
 * server has no way to know that zone, so it renders UTC and the browser
 * re-renders in local time once hydrated — `useSyncExternalStore` is the
 * supported way to let those two renders legitimately differ.
 */
export function LocalTime({
  value,
  format = "datetime",
}: {
  value: string | Date;
  format?: keyof typeof FORMATS;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const date = typeof value === "string" ? new Date(value) : value;
  const iso = date.toISOString();

  const text = new Intl.DateTimeFormat(
    hydrated ? undefined : "en-GB",
    hydrated ? FORMATS[format] : { ...FORMATS[format], timeZone: "UTC" },
  ).format(date);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
      {hydrated ? "" : " UTC"}
    </time>
  );
}
