"use client";

import { useState } from "react";

import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";

/**
 * Falls back to initials whenever the image fails to load, which covers a
 * Gravatar that was deleted after we adopted it and an upload that has gone.
 */
export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  // Recording *which* src failed means a later src is retried without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cn(
        "bg-accent text-accent-foreground relative inline-flex size-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-sm font-semibold",
        className,
      )}
    >
      {showImage ? (
        // Avatars render at fixed sizes from Gravatar and Blob, so the optimizer
        // would add a remotePatterns entry per backend for no real gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}
