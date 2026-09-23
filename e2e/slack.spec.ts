import { expect, test } from "@playwright/test";

import {
  closePool,
  getOrganizationId,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  signIn,
  signUp,
} from "./helpers";

const boss = makeUser("slackboss");
let orgId: string;

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

test("setup: an organization to connect", async ({ page }) => {
  await signUp(page, boss);
  await promoteToSuperAdmin(boss.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Iron Gym")).toBeVisible();

  orgId = await getOrganizationId("iron-gym");
});

test("an address that is not a Slack webhook is refused", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/admin/${orgId}`);

  // The server makes this request, so anything but Slack's own host would let
  // an admin point it at an internal address.
  await page
    .getByLabel("Slack webhook address")
    .fill("https://example.invalid/hook");
  await page.getByRole("button", { name: "Connect Slack" }).click();

  await expect(
    page.getByText(/should start with https:\/\/hooks\.slack\.com/),
  ).toBeVisible();

  // Nothing was stored, so the form is still the one on offer.
  await expect(page.getByLabel("Slack webhook address")).toBeVisible();
});

test("the digest refuses callers without the secret", async ({ request }) => {
  const response = await request.get("/api/cron/slack-digest");
  expect(response.status()).toBe(401);

  const wrong = await request.get("/api/cron/slack-digest", {
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect(wrong.status()).toBe(401);
});
