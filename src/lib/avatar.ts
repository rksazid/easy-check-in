// No `server-only` marker here: the Better Auth CLI has to load this module
// through auth.ts. The `node:crypto` import already fails any client bundle.
import { createHash } from "node:crypto";

const GRAVATAR_BASE = "https://gravatar.com/avatar";

/**
 * `404` is what lets us detect "this person has no Gravatar"; the others make
 * Gravatar generate a placeholder instead, which would always look like a hit.
 */
export type GravatarFallback = "404" | "mp" | "identicon" | "retro" | "blank";

export function gravatarHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function gravatarUrl(
  email: string,
  options: { size?: number; fallback?: GravatarFallback } = {},
): string {
  const { size, fallback = "404" } = options;
  const params = new URLSearchParams();
  if (size) params.set("s", String(size));
  params.set("d", fallback);
  return `${GRAVATAR_BASE}/${gravatarHash(email)}?${params.toString()}`;
}

/**
 * Returns false whenever we cannot prove an avatar exists — a slow or broken
 * Gravatar must never block sign-up, it just means we offer an upload instead.
 */
export async function hasGravatar(email: string, timeoutMs = 2500) {
  try {
    const response = await fetch(gravatarUrl(email, { size: 200 }), {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}
