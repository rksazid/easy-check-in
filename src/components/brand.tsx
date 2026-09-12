import { cn } from "@/lib/utils";

/**
 * The mark is a geofence seen from above: a place, and the radius you have to be
 * inside of. It is the same shape as the check-in button, at a different size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8", className)}
      fill="none"
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.4"
      />
      <circle
        cx="16"
        cy="16"
        r="8.5"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.75"
      />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="size-7 text-signal" />
      <span className="text-lg font-semibold tracking-tight">Easy Check-In</span>
    </span>
  );
}
