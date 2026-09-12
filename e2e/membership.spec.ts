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

test("a second super admin can manage an organization they never joined", async ({
  page,
}) => {
  // Iron Gym was created by `boss`, who owns it. This account oversees the app
  // but is a member of nothing — the situation for anyone who takes over
  // administration later.
  const overseer = makeUser("overseer");
  await signUp(page, overseer);
  await promoteToSuperAdmin(overseer.email);
  await page.reload();

  await page.getByRole("link", { name: "Super admin" }).click();

  // Every organization listed here offers a Manage link, so every one of them
  // has to open.
  // count() does not auto-wait, so the list has to be on screen before counting.
  await expect(page.getByRole("heading", { name: /All organizations/ })).toBeVisible();

  const manageLinks = page.getByRole("link", { name: "Manage" });
  const count = await manageLinks.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index++) {
    const href = await manageLinks.nth(index).getAttribute("href");
    const response = await page.goto(href as string);
    expect(response?.status(), `${href} should open for a super admin`).toBe(
      200,
    );
    await page.goBack();
  }

  await signOut(page);
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
