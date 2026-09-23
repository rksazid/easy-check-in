import { expect, test } from "@playwright/test";

import {
  closePool,
  makeUser,
  resetDatabase,
  signIn,
  signUp,
} from "./helpers";

const user = makeUser("offliner");

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

test("setup: an account to sign in with", async ({ page }) => {
  await signUp(page, user);
});

test("losing the connection is announced rather than left silent", async ({
  page,
  context,
}) => {
  await signIn(page, user);
  await expect(page.getByText(/No connection/)).toHaveCount(0);

  await context.setOffline(true);
  // The hook reacts to the browser's own offline event.
  await expect(page.getByText(/No connection/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/No connection/)).toHaveCount(0);
});
