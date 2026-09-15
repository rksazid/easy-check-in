import { expect, test } from "@playwright/test";

import {
  closePool,
  getOrganizationId,
  getTagId,
  makeUser,
  promoteToSuperAdmin,
  resetDatabase,
  seedPlace,
  seedVisit,
  signIn,
  signOut,
  signUp,
} from "./helpers";

const boss = makeUser("tagboss");
const alice = makeUser("tagalice");

let orgId: string;

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

test("setup: an organization with two people and a visit each", async ({
  page,
}) => {
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

  // Alice joins by invitation.
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

  const placeId = await seedPlace({
    organizationSlug: "iron-gym",
    name: "Riverside Branch",
    latitude: 51.5081,
    longitude: -0.1281,
  });

  // Two hours for the boss, one for Alice, both inside March 2026.
  await seedVisit({
    email: boss.email,
    placeId,
    checkedInAt: "2026-03-05T09:00:00Z",
    checkedOutAt: "2026-03-05T11:00:00Z",
  });
  await seedVisit({
    email: alice.email,
    placeId,
    checkedInAt: "2026-03-06T09:00:00Z",
    checkedOutAt: "2026-03-06T10:00:00Z",
  });
});

test("an admin creates tags and puts one on a person", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/admin/${orgId}`);

  await page.getByLabel("New tag name").fill("Project Apollo");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Tag added")).toBeVisible();

  await page.getByLabel("New tag name").fill("Night shift");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Tag added")).toBeVisible();

  // Names are compared without case, so a near-duplicate is refused.
  await page.getByLabel("New tag name").fill("project apollo");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByText("There is already a tag called project apollo."),
  ).toBeVisible();

  // Put Project Apollo on Alice only.
  const aliceRow = page.getByRole("listitem").filter({ hasText: alice.name });
  await aliceRow.getByRole("button", { name: "Edit tags" }).click();
  await aliceRow.getByRole("button", { name: "Project Apollo" }).click();

  await expect(page.getByText("1 person")).toBeVisible();
});

test("the same tag shows on the organization page", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/orgs/${orgId}`);

  await expect(page.getByRole("heading", { name: "Tags in use" })).toBeVisible();

  const aliceRow = page.getByRole("listitem").filter({ hasText: alice.name });
  await expect(aliceRow.getByText("Project Apollo")).toBeVisible();
});

test("a report can be narrowed to one tag", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/admin/${orgId}/reports?month=2026-03`);

  // Unfiltered: both people, three hours between them.
  await expect(page.getByText("3h 00m").first()).toBeVisible();
  await expect(page.getByText(alice.name)).toBeVisible();
  await expect(page.getByText(boss.name)).toBeVisible();

  const apollo = await getTagId("iron-gym", "Project Apollo");
  await page.goto(`/admin/${orgId}/reports?month=2026-03&tag=${apollo}`);

  // Only Alice carries the tag, so only her hour counts.
  await expect(page.getByText("1h 00m").first()).toBeVisible();
  await expect(page.getByText(alice.name)).toBeVisible();
  await expect(page.getByText(boss.name)).toHaveCount(0);
});

test("deleting a tag takes it off everyone", async ({ page }) => {
  await signIn(page, boss);
  await page.goto(`/admin/${orgId}`);

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: "Night shift" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Tag deleted")).toBeVisible();

  await expect(page.getByText("Night shift")).toHaveCount(0);
});

test("a member sees their own tag without being an admin", async ({ page }) => {
  // Alice is a plain member, so none of this is reachable through the admin UI.
  await signIn(page, alice);

  await page.getByRole("link", { name: "Organizations" }).click();
  const orgRow = page.getByRole("listitem").filter({ hasText: "Iron Gym" });
  await expect(orgRow.getByText("Project Apollo")).toBeVisible();

  // Exact: the avatar beside it is labelled "Your profile".
  await page.getByRole("link", { name: "You", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Where you belong" }),
  ).toBeVisible();
  await expect(page.getByText("Project Apollo")).toBeVisible();

  // And on the organization itself, against her own name.
  await page.goto(`/orgs/${orgId}`);
  const aliceRow = page.getByRole("listitem").filter({ hasText: alice.name });
  await expect(aliceRow.getByText("Project Apollo")).toBeVisible();

  // A plain member gets no editing controls anywhere.
  await expect(page.getByRole("button", { name: "Edit tags" })).toHaveCount(0);
});

test("someone with no tags is told so rather than shown an empty space", async ({
  page,
}) => {
  await signIn(page, boss);
  await page.goto("/profile");

  await expect(
    page.getByRole("heading", { name: "Where you belong" }),
  ).toBeVisible();
  // The boss was never tagged.
  await expect(page.getByText("No tags here yet")).toBeVisible();
});

test("@screens capture the member view of tags", async ({ page }) => {
  await signIn(page, alice);
  await page.setViewportSize({ width: 420, height: 900 });

  await page.goto("/orgs");
  await page.screenshot({ path: "screenshots/06-orgs-with-tag.png" });

  await page.goto("/profile");
  await page.screenshot({ path: "screenshots/07-profile-tags.png" });
});
