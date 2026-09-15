import { expect, test } from "@playwright/test";

import {
  closePool,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  signIn,
  signOut,
  signUp,
} from "./helpers";

const boss = makeUser("inviteboss");
const guest = makeUser("inviteguest");

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

/**
 * Invitations were invisible for every account, because the organization
 * plugin's list endpoint refuses outright unless the address is verified, and
 * this app has no email provider to verify one with.
 */
test("an invited person sees the invitation and can accept it", async ({
  page,
}) => {
  await signUp(page, guest);
  await signOut(page);

  await signUp(page, boss);
  await promoteToSuperAdmin(boss.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();
  await page.getByLabel("Name").fill("Iron Gym");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Iron Gym")).toBeVisible();

  await page.getByRole("link", { name: "Manage" }).first().click();
  await page
    .getByLabel("Search registered accounts by email")
    .fill(guest.email);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Invitation sent to ${guest.name}`)).toBeVisible();
  await signOut(page);

  // The invitee finds it waiting without any email having been sent.
  await signIn(page, guest);
  await page.getByRole("link", { name: "Organizations" }).click();

  await expect(page.getByText("Invitations waiting for you")).toBeVisible();
  await expect(page.getByText(`Invited by ${boss.name}`)).toBeVisible();

  // The reason the page queries the table itself: the plugin's own endpoint
  // refuses any account without a verified email address, and nothing here can
  // verify one. If this ever stops failing, the workaround can go.
  const viaPlugin = await page.request.get(
    "/api/auth/organization/list-user-invitations",
  );
  expect(viaPlugin.status()).toBe(403);

  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Invitation accepted")).toBeVisible();

  await expect(page.getByText("You belong to")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Iron Gym" }),
  ).toBeVisible();
});

test("declining an invitation removes it", async ({ page }) => {
  const other = makeUser("decliner");
  await signUp(page, other);
  await signOut(page);

  await signIn(page, boss);
  await page.goto("/orgs");
  await page.getByRole("link", { name: "Manage" }).first().click();
  await page
    .getByLabel("Search registered accounts by email")
    .fill(other.email);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Invitation sent to ${other.name}`)).toBeVisible();
  await signOut(page);

  await signIn(page, other);
  await page.getByRole("link", { name: "Organizations" }).click();
  await expect(page.getByText("Invitations waiting for you")).toBeVisible();

  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Invitation declined")).toBeVisible();
  await expect(page.getByText("Invitations waiting for you")).toHaveCount(0);
});
