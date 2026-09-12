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

const boss = makeUser("boss");
const alice = makeUser("alice");

test.beforeAll(resetDatabase);
test.afterAll(closePool);

test.describe.configure({ mode: "serial" });

test("a super admin creates an organization", async ({ page }) => {
  await signUp(page, boss);
  await promoteToSuperAdmin(boss.email);

  // The nav only offers Super admin once the role is in place.
  await page.reload();
  await page.getByRole("link", { name: "Super admin" }).click();

  await page.getByLabel("Name").fill("Iron Gym");
  await expect(page.getByLabel("Slug")).toHaveValue("iron-gym");
  await page.getByRole("button", { name: "Create organization" }).click();

  await expect(page.getByText("Iron Gym")).toBeVisible();
  await signOut(page);
});

test("a member asks to join and the admin approves", async ({ page }) => {
  await signUp(page, alice);

  await page.getByRole("link", { name: "Organizations" }).click();
  // Matched without the leading "You’re" because the page uses a curly apostrophe.
  await expect(page.getByText(/not in an organization yet/)).toBeVisible();

  await page.getByRole("button", { name: "Ask to join" }).click();
  await page.getByLabel("Note for the admin").fill("I train here on Tuesdays");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await signOut(page);

  // The admin sees the request, with the note, and approves it.
  await signIn(page, boss);
  await page.getByRole("link", { name: "Organizations" }).click();
  await page.getByRole("link", { name: "Manage" }).first().click();

  await expect(page.getByText(alice.name)).toBeVisible();
  await expect(page.getByText("I train here on Tuesdays")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("Nothing waiting.")).toBeVisible();
  await signOut(page);

  // Alice is now a member.
  await signIn(page, alice);
  await page.getByRole("link", { name: "Organizations" }).click();
  await expect(page.getByText("You belong to")).toBeVisible();
  await expect(page.getByText("Iron Gym")).toBeVisible();
});

test("a plain member cannot reach admin or super-admin pages", async ({
  page,
}) => {
  await signIn(page, alice);

  // Alice is a plain member of Iron Gym, so no Manage link is offered.
  await page.goto("/orgs");
  await expect(page.getByRole("link", { name: "Manage" })).toHaveCount(0);

  // Super admin redirects away rather than rendering.
  await page.goto("/sa");
  await expect(page).toHaveURL("/");

  // Managing an organization she is not an admin of is a 404, which leaks
  // nothing about whether that organization exists.
  const response = await page.goto("/admin/does-not-exist");
  expect(response?.status()).toBe(404);
});
