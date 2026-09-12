import { expect, test, type Page } from "@playwright/test";

import {
  acceptLocationConsent,
  closePool,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  seedPlace,
  searchNearbyPlaces,
  signIn,
  signOut,
  signUp,
} from "./helpers";

const owner = makeUser("owner");

// Trafalgar Square: where every place in this file is pinned.
const GYM = { latitude: 51.5081, longitude: -0.1281 };

test.use({ permissions: ["geolocation"], geolocation: GYM });

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

test("a member's place waits for approval before anyone can check in to it", async ({
  page,
  context,
}) => {
  const member = makeUser("proposer");

  // Join the organization the owner set up in the first test.
  await signUp(page, member);
  await page.getByRole("link", { name: "Organizations" }).click();
  await page.getByRole("button", { name: "Ask to join" }).click();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await signOut(page);

  await signIn(page, owner);
  await page.goto("/orgs");
  await page.getByRole("link", { name: "Manage" }).first().click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Nothing waiting.")).toBeVisible();
  await signOut(page);

  // The member adds a place. It is not usable yet.
  await stubExternalMapServices(page);
  await signIn(page, member);
  await page.goto("/orgs");
  await page.getByRole("link", { name: "Places" }).first().click();
  await page.getByRole("link", { name: "Add a place" }).click();

  await page.getByLabel("Name").fill("Members Annexe");
  await page.getByLabel("Kind of place").click();
  await page.getByRole("option", { name: "Gym" }).click();
  await page.getByLabel("Or paste coordinates").fill("51.5081, -0.1281");
  await page.getByRole("button", { name: "Go" }).click();
  await page.getByRole("button", { name: "Submit for approval" }).click();

  await expect(page.getByText("Waiting for approval")).toBeVisible();

  // Standing right on top of it, the check-in page finds the approved place at
  // the same coordinates but not this one. Asserting the approved place appears
  // is what stops this passing merely because nothing loaded.
  await context.setGeolocation(GYM);
  await page.goto("/");
  await acceptLocationConsent(page);
  await searchNearbyPlaces(page);
  await expect(
    page.getByRole("heading", { name: "Riverside Branch" }),
  ).toBeVisible();
  await expect(page.getByText("Members Annexe")).toHaveCount(0);
  await signOut(page);

  // The admin approves it.
  await signIn(page, owner);
  await page.goto("/orgs");
  await page.getByRole("link", { name: "Places" }).first().click();
  await expect(page.getByText("added by Proposer Tester")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Members Annexe approved")).toBeVisible();
  await signOut(page);

  // Now it is offered alongside the others.
  await signIn(page, member);
  await page.goto("/");
  await acceptLocationConsent(page);
  await searchNearbyPlaces(page);
  await expect(page.getByText("Members Annexe")).toBeVisible();
});

test("a rejected place never becomes checkable", async ({ page }) => {
  await stubExternalMapServices(page);

  const placeId = await seedPlace({
    organizationSlug: "iron-gym",
    name: "Rejected Spot",
    latitude: 51.5081,
    longitude: -0.1281,
    status: "pending",
  });
  expect(placeId).toBeTruthy();

  await signIn(page, owner);
  await page.goto("/orgs");
  await page.getByRole("link", { name: "Places" }).first().click();

  await page
    .getByRole("listitem")
    .filter({ hasText: "Rejected Spot" })
    .getByRole("button", { name: "Reject" })
    .click();
  await expect(page.getByText("Rejected Spot rejected")).toBeVisible();

  await page.goto("/");
  await acceptLocationConsent(page);
  await searchNearbyPlaces(page);
  await expect(
    page.getByRole("heading", { name: "Riverside Branch" }),
  ).toBeVisible();
  await expect(page.getByText("Rejected Spot")).toHaveCount(0);
});
