function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/**
 * Accessed lazily so that `next build` succeeds in environments where runtime
 * secrets are not present; the throw happens on first real use instead.
 */
export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get BETTER_AUTH_SECRET() {
    return required("BETTER_AUTH_SECRET");
  },
  get BETTER_AUTH_URL() {
    return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  },
};

/** Absolute origin, for links in messages that leave the app (Slack, email). */
export function appUrl() {
  return env.BETTER_AUTH_URL.replace(/\/$/, "");
}
