import { expect, test, type Page } from "@playwright/test";

import {
  acceptLocationConsent,
  closePool,
  getOrganizationId,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  seedPlace,
  seedVisit,
  signIn,
  signOut,
  signUp,
} from "./helpers";

const athlete = makeUser("tracker");
const GYM = { latitude: 51.5081, longitude: -0.1281 };

let orgId: string;

test.use({ permissions: ["geolocation"], geolocation: GYM });
test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

/** Collects anything React reports as a hydration problem. */
function watchForHydrationErrors(page: Page) {
  const seen: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/hydrat/i.test(text)) seen.push(text);
  });
  return seen;
}

test("setup: an organization with a place and some visits", async ({ page }) => {
  await signUp(page, athlete);
  await promoteToSuperAdmin(athlete.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  await page.getByLabel("Time zone").fill("UTC");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Iron Gym")).toBeVisible();

  orgId = await getOrganizationId("iron-gym");

  const placeId = await seedPlace({
    organizationSlug: "iron-gym",
    name: "Riverside Branch",
    latitude: GYM.latitude,
    longitude: GYM.longitude,
  });

  await seedVisit({
    email: athlete.email,
    placeId,
    checkedInAt: "2026-09-02T09:00:00Z",
    checkedOutAt: "2026-09-02T11:00:00Z",
  });
});

test("the check-in page hydrates without a mismatch", async ({ page }) => {
  const hydrationErrors = watchForHydrationErrors(page);

  await signIn(page, athlete);
  await page.goto("/");
  // The consent screen is what used to differ between server and client, since
  // the answer lived in localStorage that the server could not read.
  await expect(
    page.getByRole("heading", { name: "Checking in uses your location" }),
  ).toBeVisible();

  await acceptLocationConsent(page);
  await expect(
    page.getByRole("heading", { name: "Riverside Branch" }),
  ).toBeVisible();

  // Reloading with consent already given is the case that used to mismatch.
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  expect(hydrationErrors, hydrationErrors.join("\n")).toEqual([]);
});

test("the activity page totals the month and links into each visit", async ({
  page,
}) => {
  await signIn(page, athlete);
  await page.getByRole("link", { name: "Activity" }).click();

  await expect(
    page.getByRole("heading", { name: `Hello, ${athlete.name.split(" ")[0]}` }),
  ).toBeVisible();

  // The seeded visit is two hours long.
  await expect(page.getByText("2h 00m").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();

  await page.getByRole("link", { name: /Riverside Branch/ }).first().click();
  await expect(page).toHaveURL(/\/visits\//);
});

test("a visit page shows the times and the readings behind them", async ({
  page,
}) => {
  await signIn(page, athlete);
  await page.goto("/activity");
  await page.getByRole("link", { name: /Riverside Branch/ }).first().click();

  await expect(
    page.getByRole("heading", { name: "Riverside Branch" }),
  ).toBeVisible();
  await expect(page.getByText("Arrived")).toBeVisible();
  await expect(page.getByText("Left")).toBeVisible();
  await expect(page.getByText("Time there")).toBeVisible();
  await expect(page.getByText("2h 00m")).toBeVisible();

  // This one was seeded straight into the table, so it has no readings.
  await expect(
    page.getByText("No readings were recorded for this visit."),
  ).toBeVisible();
});

test("a visit belonging to someone else is not readable", async ({ page }) => {
  await signIn(page, athlete);
  await page.goto("/activity");
  await page.getByRole("link", { name: /Riverside Branch/ }).first().click();
  // Wait for the navigation before reading the URL, or this captures /activity.
  await expect(page).toHaveURL(/\/visits\//);
  const visitUrl = page.url();

  // Signing up while still signed in would just redirect back to the app.
  const outsider = makeUser("nosy");
  await signOut(page);
  await signUp(page, outsider);

  const response = await page.goto(visitUrl);
  expect(response?.status()).toBe(404);
});

test("the organization page lists the people in it", async ({ page }) => {
  await signIn(page, athlete);
  await page.goto("/orgs");
  await page.getByRole("link", { name: "Iron Gym" }).click();

  await expect(page).toHaveURL(`/orgs/${orgId}`);
  await expect(page.getByRole("heading", { name: "Iron Gym" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByText(athlete.name)).toBeVisible();
  // Scoped to the page body: the nav also has a tab called "You".
  await expect(
    page.getByRole("main").getByText("You", { exact: true }),
  ).toBeVisible();
});
