import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization, username } from "better-auth/plugins";

// Relative (not "@/...") so the Better Auth CLI's loader can resolve this file.
import { db } from "./db/client";
import { env } from "./env";

/**
 * App-level super admins are the only accounts allowed to create organizations.
 * The admin plugin stores roles as a comma-separated string on `user.role`.
 */
function isSuperAdmin(user: Record<string, unknown>) {
  const role = user.role;
  return typeof role === "string" && role.split(",").includes("admin");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No transactional email provider in v1, so verification would lock users out.
    requireEmailVerification: false,
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    organization({
      creatorRole: "owner",
      allowUserToCreateOrganization: async (user) => isSuperAdmin(user),
      // Invitations are delivered in-app; this callback intentionally does nothing.
      sendInvitationEmail: async () => {},
    }),
    admin(),
    // Must stay last: it forwards Set-Cookie from server actions to the response.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
