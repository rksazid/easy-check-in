import { expect, test, type Page } from "@playwright/test";

import {
  closePool,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  signIn,
  signUp,
} from "./helpers";

const owner = makeUser("owner");

test.beforeAll(resetDatabase);
test.afterAll(closePool);

test.describe.configure({ mode: "serial" });

/**
 * Keeps the suite off the public tile and geocoding services: fast, repeatable,
 * and polite to providers whose fair-use policies we rely on.
 */
async function stubExternalMapServices(page: Page) {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.route("**/api/geocode**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            label: "Trafalgar Square, London, United Kingdom",
            latitude: 51.5081,
            longitude: -0.1281,
          },
        ],
      }),
    }),
  );
}

test("an admin adds a place, edits its radius, then archives it", async ({
  page,
}) => {
  await stubExternalMapServices(page);

  await signUp(page, owner);
  await promoteToSuperAdmin(owner.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Iron Gym")).toBeVisible();

  await page.getByRole("link", { name: "Manage" }).first().click();
  await page.getByRole("link", { name: "Places" }).click();
  await expect(page.getByText(/No places yet/)).toBeVisible();

  // --- create -------------------------------------------------------------
  await page.getByRole("link", { name: "Add a place" }).click();
  await page.getByLabel("Name").fill("Riverside Branch");

  await page.getByLabel("Kind of place").click();
  await page.getByRole("option", { name: "Gym" }).click();

  // Typing coordinates is the reliable path in a test; clicking a tile layer
  // would depend on map rendering.
  await page
    .getByLabel("Or paste coordinates")
    .fill("51.5081, -0.1281");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page.getByText("51.508100, -0.128100")).toBeVisible();

  await page.getByRole("button", { name: "Add place" }).click();

  await expect(page.getByText("Riverside Branch")).toBeVisible();
  await expect(page.getByText("51.50810, -0.12810")).toBeVisible();
  await expect(page.getByText("150 m")).toBeVisible();

  // --- edit ---------------------------------------------------------------
  await page.getByRole("link", { name: "Riverside Branch" }).click();
  const radius = page.getByRole("slider");
  await radius.fill("300");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("300 m")).toBeVisible();

  // --- archive ------------------------------------------------------------
  // Exact, because the success toast also contains the word "archived".
  const archivedBadge = page.getByText("Archived", { exact: true });
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(archivedBadge).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(archivedBadge).toHaveCount(0);
});

test("coordinates outside the valid range are refused", async ({ page }) => {
  await stubExternalMapServices(page);

  // Each test gets its own browser context, so the session must be re-established.
  await signIn(page, owner);
  await page.goto("/orgs");
  await page.getByRole("link", { name: "Manage" }).first().click();
  await page.getByRole("link", { name: "Places" }).click();
  await page.getByRole("link", { name: "Add a place" }).click();

  // Matched by text, not by role: Next's route announcer is also role="alert".
  await page.getByLabel("Or paste coordinates").fill("91, 0");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(
    page.getByText("Latitude must be between -90 and 90."),
  ).toBeVisible();

  await page.getByLabel("Or paste coordinates").fill("not coordinates");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(
    page.getByText(/Enter coordinates as latitude, longitude/),
  ).toBeVisible();
});
