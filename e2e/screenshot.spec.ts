import { expect, test } from "@playwright/test";

import {
  acceptLocationConsent,
  closePool,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  seedPlace,
  signUp,
} from "./helpers";

/**
 * Not an assertion — a way to look at the finished screens. Run with
 * `npx playwright test e2e/screenshot.spec.ts --grep @screens`.
 */
const GYM = { latitude: 51.5081, longitude: -0.1281 };

test.use({ permissions: ["geolocation"], geolocation: GYM });
test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

test("@screens capture the check-in screens", async ({ page }) => {
  const user = makeUser("shot");
  await signUp(page, user);
  await promoteToSuperAdmin(user.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  await page.getByRole("button", { name: "Create organization" }).click();
  // Wait for the row to appear, otherwise the place is seeded before the
  // organization exists.
  await expect(page.getByText("Iron Gym")).toBeVisible();

  await seedPlace({
    organizationSlug: "iron-gym",
    name: "Riverside Branch",
    latitude: GYM.latitude,
    longitude: GYM.longitude,
  });

  await page.setViewportSize({ width: 420, height: 900 });

  await page.goto("/");
  await page.screenshot({ path: "screenshots/01-consent.png" });

  await acceptLocationConsent(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/02-ready-to-check-in.png" });

  await page.getByRole("button", { name: "Check in", exact: false }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/03-checked-in.png" });
});
