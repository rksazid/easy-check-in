"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  LOCATION_CONSENT_COOKIE,
  LOCATION_CONSENT_COOKIE_OPTIONS,
} from "@/lib/consent";
import { requireSession } from "@/lib/session";

/** Records that the explanation was shown and accepted on this device. */
export async function grantLocationConsent() {
  await requireSession();

  const store = await cookies();
  store.set(LOCATION_CONSENT_COOKIE, "1", LOCATION_CONSENT_COOKIE_OPTIONS);

  revalidatePath("/");
}
