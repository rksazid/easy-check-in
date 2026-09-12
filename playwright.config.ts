import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * E2E runs against its own database and its own server on a separate port, so a
 * run never disturbs whatever the developer has open on :3000.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        "postgresql://localhost:5432/easy_check_in_e2e",
      BETTER_AUTH_SECRET: "e2e-secret-at-least-32-characters-long!!",
      BETTER_AUTH_URL: baseURL,
    },
  },
});
