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
  signUp,
} from "./helpers";

const boss = makeUser("reportboss");

let orgId: string;

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

const reportUrl = (month: string) =>
  `/admin/${orgId}/reports?month=${month}`;

test("setup: an organization with a month of visits", async ({ page }) => {
  await signUp(page, boss);
  await promoteToSuperAdmin(boss.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  // The organization runs on UTC, so month edges are unambiguous in this test.
  await page.getByLabel("Time zone").fill("UTC");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Iron Gym")).toBeVisible();

  orgId = await getOrganizationId("iron-gym");

  const placeId = await seedPlace({
    organizationSlug: "iron-gym",
    name: "Riverside Branch",
    latitude: 51.5081,
    longitude: -0.1281,
  });

  // Two clean visits inside March 2026: 2 hours and 1 hour 30.
  await seedVisit({
    email: boss.email,
    placeId,
    checkedInAt: "2026-03-05T09:00:00Z",
    checkedOutAt: "2026-03-05T11:00:00Z",
  });
  await seedVisit({
    email: boss.email,
    placeId,
    checkedInAt: "2026-03-06T18:00:00Z",
    checkedOutAt: "2026-03-06T19:30:00Z",
  });

  // A visit straddling midnight on the 1st: only the March hour may count.
  await seedVisit({
    email: boss.email,
    placeId,
    checkedInAt: "2026-02-28T23:00:00Z",
    checkedOutAt: "2026-03-01T01:00:00Z",
  });
});

test("the monthly report totals only the time inside the month", async ({
  page,
}) => {
  await signIn(page, boss);

  await page.goto(reportUrl("2026-03"));
  await expect(page.getByRole("heading", { name: "March 2026" })).toBeVisible();

  // 2h + 1h30 in full, plus only the hour of the straddling visit that falls
  // after midnight on 1 March: 4h 30m across 3 visits.
  await expect(page.getByText("4h 30m").first()).toBeVisible();

  // February keeps the straddling visit's other hour, and nothing else.
  await page.goto(reportUrl("2026-02"));
  await expect(
    page.getByRole("heading", { name: "February 2026" }),
  ).toBeVisible();
  await expect(page.getByText("1h 00m").first()).toBeVisible();
});

test("a month with no visits reads as empty rather than broken", async ({
  page,
}) => {
  await signIn(page, boss);
  await page.goto(reportUrl("2026-01"));

  await expect(
    page.getByText("No completed visits in this month."),
  ).toBeVisible();
  await expect(page.getByText("0m").first()).toBeVisible();
});

test("the CSV download carries the same figures", async ({ page }) => {
  await signIn(page, boss);

  const response = await page.request.get(
    `/api/orgs/${orgId}/report.csv?month=2026-03`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(response.headers()["content-disposition"]).toContain(
    "iron-gym-attendance-2026-03.csv",
  );

  const body = await response.text();
  expect(body).toContain("Name");
  expect(body).toContain(boss.email);
  // 4.5 hours as a decimal, on the member row and again on the total row.
  expect(body).toContain('"4.50"');
});

test("a non-admin cannot download another organization's CSV", async ({
  page,
}) => {
  const outsider = makeUser("outsider");
  await signUp(page, outsider);

  const response = await page.request.get(
    `/api/orgs/${orgId}/report.csv?month=2026-03`,
  );
  // requireOrgAdmin sends a 404 rather than revealing the organization exists.
  expect(response.status()).toBe(404);
});
