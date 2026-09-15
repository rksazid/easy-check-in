import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization, username } from "better-auth/plugins";

// Relative (not "@/...") so the Better Auth CLI's loader can resolve this file.
import { gravatarUrl, hasGravatar } from "./avatar";
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
  rateLimit: {
    // On by default in production. The browser suite signs in dozens of times
    // from a single IP within seconds, so it opts out explicitly rather than
    // weakening the limit that protects the real deployment.
    enabled: process.env.AUTH_DISABLE_RATE_LIMIT !== "1",
  },
  user: {
    additionalFields: {
      // Where `image` came from, so the profile page knows which actions to offer.
      avatarSource: {
        type: "string",
        required: false,
        defaultValue: "initials",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Adopt an existing Gravatar automatically; `hasGravatar` swallows
          // network failures, so a slow Gravatar can never fail a sign-up.
          if (!(await hasGravatar(user.email))) return;
          return {
            data: {
              ...user,
              image: gravatarUrl(user.email, { size: 400 }),
              avatarSource: "gravatar",
            },
          };
        },
      },
    },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    organization({
      creatorRole: "owner",
      // We have no email provider, so no account ever gets a verified address.
      // Left at its default, accepting an invitation would be refused for
      // everyone. Invitation ids are opaque, so the link itself is the secret.
      requireEmailVerificationOnInvitation: false,
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
