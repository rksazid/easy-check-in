import { expect, test } from "@playwright/test";

import {
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

const boss = makeUser("logboss");
const alice = makeUser("logalice");

let orgId: string;

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

test("setup: an organization with visits from two people", async ({ page }) => {
  await signUp(page, alice);
  await signOut(page);

  await signUp(page, boss);
  await promoteToSuperAdmin(boss.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  await page.getByLabel("Time zone").fill("UTC");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Iron Gym")).toBeVisible();

  orgId = await getOrganizationId("iron-gym");

  await page.goto(`/admin/${orgId}`);
  await page.getByLabel("Search registered accounts by email").fill(alice.email);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Invitation sent to ${alice.name}`)).toBeVisible();
  await signOut(page);

  await signIn(page, alice);
  await page.goto("/orgs");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Invitation accepted")).toBeVisible();
  await signOut(page);

  const gym = await seedPlace({
    organizationSlug: "iron-gym",
    name: "Riverside Branch",
    latitude: 51.5081,
    longitude: -0.1281,
  });
  const office = await seedPlace({
    organizationSlug: "iron-gym",
    name: "Head Office",
    latitude: 51.5,
    longitude: -0.12,
    typeName: "Office",
  });

  await seedVisit({
    email: boss.email,
    placeId: gym,
    checkedInAt: "2026-03-05T09:00:00Z",
    checkedOutAt: "2026-03-05T11:00:00Z",
  });
  await seedVisit({
    email: alice.email,
    placeId: gym,
    checkedInAt: "2026-03-05T14:00:00Z",
    checkedOutAt: "2026-03-05T15:00:00Z",
  });
  await seedVisit({
    email: alice.email,
    placeId: office,
    checkedInAt: "2026-03-12T09:00:00Z",
    checkedOutAt: "2026-03-12T12:30:00Z",
  });
});

test("an admin reads every check-in and can narrow it", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/admin/${orgId}/check-ins?month=2026-03`);

  await expect(page.getByRole("heading", { name: "Check-ins" })).toBeVisible();
  await expect(page.getByText("3 visits")).toBeVisible();
  await expect(page.getByText(boss.name)).toBeVisible();
  await expect(page.getByText(alice.name).first()).toBeVisible();

  // Narrowing to one person leaves only their two visits.
  await page.goto(
    `/admin/${orgId}/check-ins?month=2026-03&place=&person=${await personId(page, alice.email)}`,
  );
  await expect(page.getByText("2 visits")).toBeVisible();
  await expect(page.getByText(boss.name)).toHaveCount(0);
});

/** Reads a member's user id from the database. */
async function personId(_page: unknown, email: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.E2E_DATABASE_URL ??
      "postgresql://localhost:5432/easy_check_in_e2e",
  });
  try {
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1',
      [email],
    );
    return rows[0].id;
  } finally {
    await pool.end();
  }
}

test("a check-in row opens the visit behind it", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/admin/${orgId}/check-ins?month=2026-03`);

  await page.getByRole("link", { name: /Riverside Branch/ }).first().click();
  await expect(page).toHaveURL(/\/visits\//);
  await expect(page.getByText("Arrived")).toBeVisible();
  // An admin reading somebody else's visit is told so.
  await expect(page.getByText("You are seeing this as an admin.")).toBeVisible();
});

test("the report shows a chart and what stands out", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/admin/${orgId}/reports?month=2026-03`);

  await expect(page.getByRole("heading", { name: "Time by day" })).toBeVisible();
  await expect(page.getByText(/Hours recorded each day/)).toBeVisible();
  // Each column carries its own label, so the data is reachable without hover.
  await expect(
    page.getByRole("button", { name: /12 Mar|^12:/ }).first(),
  ).toBeAttached();

  await expect(
    page.getByRole("heading", { name: "What stands out" }),
  ).toBeVisible();
  // Busiest means most time, not most visits: 12 March has one 3h30 visit,
  // 5 March has two adding to 3h.
  await expect(page.getByText(/Busiest day was.*12 Mar/)).toBeVisible();
  await expect(page.getByText(/2 of 2 people checked in/)).toBeVisible();

  await expect(page.getByRole("heading", { name: "By place" })).toBeVisible();
});

test("a plain member cannot read the check-in log", async ({ page }) => {
  await signIn(page, alice);
  const response = await page.goto(`/admin/${orgId}/check-ins`);
  expect(response?.status()).toBe(404);
});

test("@screens capture the report and the log", async ({ page }) => {
  await signIn(page, boss);
  await page.setViewportSize({ width: 900, height: 1100 });

  await page.goto(`/admin/${orgId}/reports?month=2026-03`);
  await page.screenshot({ path: "screenshots/08-report-charts.png" });

  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto(`/admin/${orgId}/check-ins?month=2026-03`);
  await page.screenshot({ path: "screenshots/09-check-in-log.png" });
});
