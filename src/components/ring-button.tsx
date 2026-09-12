"use client";

import { cn } from "@/lib/utils";

/**
 * The one action on the page, drawn as the geofence seen from above: a dashed
 * outer ring for the radius, a solid disc for the place. Deliberately large —
 * this gets pressed one-handed, outdoors, often in a hurry.
 */
export function RingButton({
  label,
  sublabel,
  tone = "go",
  disabled,
  pending,
  onClick,
}: {
  label: string;
  sublabel?: string;
  tone?: "go" | "stop";
  disabled?: boolean;
  pending?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={cn(
        "group relative grid size-56 place-items-center rounded-full transition",
        "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-4",
        "focus-visible:ring-offset-background disabled:cursor-not-allowed",
        disabled
          ? "bg-muted text-muted-foreground"
          : tone === "go"
            ? "bg-signal text-signal-foreground hover:brightness-105 active:scale-[0.97]"
            : "bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.97]",
      )}
    >
      {/* The radius ring. Static by default; it only animates while working. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-[-14px] rounded-full border-2 border-dashed",
          disabled ? "border-border" : "border-current opacity-40",
          pending && "motion-safe:animate-spin [animation-duration:3s]",
        )}
      />
      <span className="flex flex-col items-center gap-1 px-6 text-center">
        <span className="text-2xl font-semibold tracking-tight">
          {pending ? "Working…" : label}
        </span>
        {sublabel ? (
          <span className="text-sm opacity-80">{sublabel}</span>
        ) : null}
      </span>
    </button>
  );
}
