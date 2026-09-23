"use client";

import { useState } from "react";

import { formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ColumnPoint = {
  /** Stable key, also the tooltip's heading. */
  key: string;
  /** Short axis label. Only some are drawn, to keep the axis readable. */
  label: string;
  /** Seconds. */
  value: number;
  display: string;
  /** Extra tooltip line, e.g. how many visits made up the total. */
  detail?: string;
};

const PLOT_HEIGHT = 160;

/** A clean round number at or above the largest value, for the top gridline. */
function niceCeiling(value: number) {
  if (value <= 0) return 3600;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

/**
 * One series of columns over time, each value a number of seconds.
 *
 * Laid out with flex rather than a stretched SVG viewBox: a non-uniform
 * viewBox scales x and y by different factors, which turns a 2px gap into a
 * 15px one and squashes the rounded cap. Real pixels keep the mark specs true.
 *
 * Single hue by design. These are magnitudes of one measure, so a second colour
 * would encode nothing the height does not already say, and one series needs no
 * legend because the caption names it.
 */
export function ColumnChart({
  points,
  caption,
  everyNthLabel = 5,
}: {
  points: ColumnPoint[];
  caption: string;
  everyNthLabel?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) return null;

  const ceiling = niceCeiling(Math.max(...points.map((point) => point.value)));
  // Only the tallest column is labelled on the axis; a number on every one
  // goes unread.
  const peak = points.reduce(
    (best, point, index) => (point.value > points[best].value ? index : best),
    0,
  );

  return (
    <figure className="space-y-2">
      <div className="relative" style={{ height: PLOT_HEIGHT }}>
        {[0, 0.5, 1].map((fraction) => (
          <div
            key={fraction}
            aria-hidden="true"
            className="absolute inset-x-0 border-t"
            style={{
              bottom: fraction * PLOT_HEIGHT,
              borderColor: "var(--chart-grid)",
            }}
          />
        ))}

        <ol
          className="absolute inset-0 flex items-end gap-[2px]"
          onMouseLeave={() => setHovered(null)}
        >
          {points.map((point, index) => {
            const height = (point.value / ceiling) * PLOT_HEIGHT;

            return (
              <li
                key={point.key}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
              >
                <button
                  type="button"
                  aria-label={`${point.label}: ${point.display}`}
                  className="flex h-full w-full max-w-6 items-end justify-center outline-none"
                >
                  <span
                    className={cn(
                      "w-full rounded-t transition-opacity",
                      hovered !== null && hovered !== index && "opacity-45",
                    )}
                    style={{
                      height: Math.max(height, point.value > 0 ? 2 : 0),
                      background: "var(--chart-mark)",
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ol>

        {hovered !== null ? (
          <div
            role="status"
            className="border-border bg-popover text-popover-foreground pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-sm"
            style={{ left: `${((hovered + 0.5) / points.length) * 100}%` }}
          >
            <span className="block font-medium">{points[hovered].label}</span>
            <span className="readout block">{points[hovered].display}</span>
            {points[hovered].detail ? (
              <span className="text-muted-foreground block">
                {points[hovered].detail}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="text-muted-foreground flex justify-between text-[10px]">
        <span className="readout">0</span>
        <span className="readout">{formatHours(ceiling)}</span>
      </div>

      <ol className="text-muted-foreground flex gap-[2px] text-[10px]">
        {points.map((point, index) => (
          <li key={point.key} className="readout min-w-0 flex-1 text-center">
            {index % everyNthLabel === 0 || index === peak ? point.label : ""}
          </li>
        ))}
      </ol>

      <figcaption className="text-muted-foreground text-xs">
        {caption}
      </figcaption>
    </figure>
  );
}
