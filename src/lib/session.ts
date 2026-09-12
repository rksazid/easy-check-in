import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

/** Cached per request so multiple components can call it without re-querying. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** For pages that must not render to signed-out visitors. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export function isSuperAdmin(user: { role?: string | null }) {
  return user.role?.split(",").includes("admin") ?? false;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (!isSuperAdmin(session.user)) redirect("/");
  return session;
}
