import { expect, test } from "@playwright/test";

import {
  acceptLocationConsent,
  backdateOpenCheckIn,
  closePool,
  countOpenCheckIns,
  getCaptureKinds,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  seedPlace,
  signIn,
  signUp,
} from "./helpers";

const athlete = makeUser("athlete");

// Trafalgar Square, and a point roughly 2 km away in Hyde Park.
const GYM = { latitude: 51.5081, longitude: -0.1281 };
const FAR_AWAY = { latitude: 51.5073, longitude: -0.1657 };

test.use({ permissions: ["geolocation"], geolocation: GYM });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetDatabase();
});
test.afterAll(closePool);

/** Creates the org and place the rest of the file checks in to. */
test("setup: an organization with one gym", async ({ page }) => {
  await signUp(page, athlete);
  await promoteToSuperAdmin(athlete.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Iron Gym")).toBeVisible();

  await seedPlace({
    organizationSlug: "iron-gym",
    name: "Riverside Branch",
    latitude: GYM.latitude,
    longitude: GYM.longitude,
    radiusM: 150,
  });
});

test("checking in, storing a location, and checking out", async ({ page }) => {
  await signIn(page, athlete);

  await acceptLocationConsent(page);

  // The nearest place is offered by name, with the measured distance.
  await expect(
    page.getByRole("heading", { name: "Riverside Branch" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Check in", exact: false }).click();
  // Exact: the success toast also begins "Checked in at ...".
  await expect(page.getByText("Checked in at", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Riverside Branch" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Store my location" }).click();
  await expect(page.getByText("Location stored")).toBeVisible();

  await page.getByRole("button", { name: "Check out" }).click();
  await expect(page.getByText("Checked out of Riverside Branch")).toBeVisible();

  // The visit is closed and every explicit capture was recorded.
  expect(await countOpenCheckIns()).toBe(0);
  expect(await getCaptureKinds(athlete.email)).toEqual([
    "check_in",
    "manual",
    "check_out",
  ]);

  await expect(page.getByText("Recent visits")).toBeVisible();
});

test("being too far away prevents checking in", async ({ page, context }) => {
  await context.setGeolocation(FAR_AWAY);
  await signIn(page, athlete);
  await acceptLocationConsent(page);

  // 2 km from a 150 m radius: the place is beyond even the walk-closer buffer,
  // so there is nothing to offer at all.
  await expect(page.getByText(/Nothing to check in to within reach/)).toBeVisible();
  expect(await countOpenCheckIns()).toBe(0);
});

test("a visit left open past the cap is closed automatically", async ({
  page,
}) => {
  await signIn(page, athlete);
  await acceptLocationConsent(page);
  await page.getByRole("button", { name: "Check in", exact: false }).click();
  // Exact: the success toast also begins "Checked in at ...".
  await expect(page.getByText("Checked in at", { exact: true })).toBeVisible();
  expect(await countOpenCheckIns()).toBe(1);

  // Older than the 12-hour default cap.
  await backdateOpenCheckIn(athlete.email, 20);

  await page.reload();
  await expect(page.getByText("Checked in at", { exact: true })).toHaveCount(0);
  expect(await countOpenCheckIns()).toBe(0);

  // Closed at the cap, not at "now", so a forgotten check-out cannot inflate it.
  // How a visit ended is spelled out in the history on the activity page.
  await page.goto("/activity");
  await expect(page.getByText("Closed automatically").first()).toBeVisible();
  await expect(page.getByText("12h 00m").first()).toBeVisible();
});
