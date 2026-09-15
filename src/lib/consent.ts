import { cookies } from "next/headers";

export const LOCATION_CONSENT_COOKIE = "eci_location_consent";

/** A year: long enough that nobody is asked twice on the same device. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const LOCATION_CONSENT_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: "lax",
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
} as const;

/**
 * Whether this device has seen the explanation of what location is used for.
 *
 * Kept in a cookie rather than localStorage so the server renders the right
 * screen first time. Reading it on the client instead produced a hydration
 * mismatch: the server always assumed no consent, then the browser found it and
 * swapped the whole panel out.
 */
export async function hasLocationConsent() {
  const store = await cookies();
  return store.get(LOCATION_CONSENT_COOKIE)?.value === "1";
}
