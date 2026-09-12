import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://localhost:5432/easy_check_in_e2e";

const pool = new Pool({ connectionString: E2E_DATABASE_URL });

export async function resetDatabase() {
  await pool.query(
    `TRUNCATE "user", session, account, verification,
              organization, member, invitation,
              join_requests, organization_settings CASCADE`,
  );
}

export async function promoteToSuperAdmin(email: string) {
  await pool.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [
    email,
  ]);
}

export async function closePool() {
  await pool.end();
}

export type TestUser = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export function makeUser(username: string): TestUser {
  return {
    name: `${username[0].toUpperCase()}${username.slice(1)} Tester`,
    username,
    email: `${username}@example.invalid`,
    password: "supersecret123",
  };
}

export async function signUp(page: Page, user: TestUser) {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("link", { name: "Check in" })).toBeVisible();
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/sign-in");
  await page.getByLabel("Email or username").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Check in" })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}
