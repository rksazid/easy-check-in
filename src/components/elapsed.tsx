"use client";

import { useEffect, useState } from "react";

function format(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${seconds}s`;
}

const asDate = (value: string | Date) =>
  typeof value === "string" ? new Date(value) : value;

/**
 * Duration between two instants. With `until` it is a settled figure; without
 * one it ticks, because the visit is still running.
 */
export function Elapsed({
  since,
  until,
}: {
  since: string | Date;
  until?: string | Date | null;
}) {
  const start = asDate(since).getTime();
  const end = until ? asDate(until).getTime() : null;

  if (end !== null) {
    return <span className="readout">{format((end - start) / 1000)}</span>;
  }

  return <Ticking start={start} />;
}

function Ticking({ start }: { start: number }) {
  // Seeded in the initialiser rather than an effect; the server's value differs
  // from the browser's by milliseconds, which is what suppressHydrationWarning
  // is for.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="readout" suppressHydrationWarning>
      {format((now - start) / 1000)}
    </span>
  );
}
