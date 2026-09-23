export type BarItem = {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  display: string;
};

/**
 * Horizontal bars for comparing named things. One hue for every bar: the
 * categories here have no natural order, so shading them by size would spend a
 * channel restating the length.
 */
export function BarList({
  items,
  caption,
}: {
  items: BarItem[];
  caption: string;
}) {
  if (items.length === 0) return null;

  const largest = Math.max(...items.map((item) => item.value), 1);

  return (
    <figure className="space-y-2">
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {item.label}
                {item.sublabel ? (
                  <span className="text-muted-foreground ml-2 text-xs">
                    {item.sublabel}
                  </span>
                ) : null}
              </span>
              {/* The value rides the bar's end rather than sitting on every tick. */}
              <span className="readout text-muted-foreground shrink-0">
                {item.display}
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((item.value / largest) * 100, 1.5)}%`,
                  background: "var(--chart-mark)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="text-muted-foreground text-xs">
        {caption}
      </figcaption>
    </figure>
  );
}
