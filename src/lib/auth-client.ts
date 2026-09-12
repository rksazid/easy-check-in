"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  organizationClient,
  usernameClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [usernameClient(), organizationClient(), adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
