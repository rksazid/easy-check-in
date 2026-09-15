import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://localhost:5432/easy_check_in_e2e";

// Spec files share a worker, so the pool is created on demand and can be
// reopened after an earlier file's teardown closed it.
let pool: Pool | null = null;

function getPool() {
  pool ??= new Pool({ connectionString: E2E_DATABASE_URL });
  return pool;
}

export async function resetDatabase() {
  await getPool().query(
    `TRUNCATE "user", session, account, verification,
              organization, member, invitation,
              join_requests, organization_settings, places,
              check_ins, location_captures CASCADE`,
  );
}

export async function promoteToSuperAdmin(email: string) {
  await getPool().query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [
    email,
  ]);
}

export async function closePool() {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
}

/**
 * Inserts a place directly, so check-in tests don't re-drive the map UI.
 * Approved by default, because most tests care about what happens afterwards;
 * pass `status: "pending"` to exercise the approval queue.
 */
export async function seedPlace(options: {
  organizationSlug: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM?: number;
  typeName?: string;
  status?: "pending" | "approved" | "rejected";
}) {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO places
       (id, organization_id, place_type_id, name, latitude, longitude,
        radius_m, status)
     VALUES (
       gen_random_uuid()::text,
       (SELECT id FROM organization WHERE slug = $1),
       (SELECT id FROM place_types WHERE name = $2),
       $3, $4, $5, $6, $7
     )
     RETURNING id`,
    [
      options.organizationSlug,
      options.typeName ?? "Gym",
      options.name,
      options.latitude,
      options.longitude,
      options.radiusM ?? 150,
      options.status ?? "approved",
    ],
  );
  return rows[0].id;
}

/** Backdates an open visit so the forgotten-check-out sweep will close it. */
export async function backdateOpenCheckIn(email: string, hoursAgo: number) {
  await getPool().query(
    `UPDATE check_ins
        SET checked_in_at = now() - make_interval(hours => $2)
      WHERE checked_out_at IS NULL
        AND user_id = (SELECT id FROM "user" WHERE email = $1)`,
    [email, hoursAgo],
  );
}

export async function countOpenCheckIns() {
  const { rows } = await getPool().query<{ count: string }>(
    "SELECT count(*) FROM check_ins WHERE checked_out_at IS NULL",
  );
  return Number(rows[0].count);
}

export async function getOrganizationId(slug: string) {
  const { rows } = await getPool().query<{ id: string }>(
    "SELECT id FROM organization WHERE slug = $1",
    [slug],
  );
  return rows[0].id;
}

export async function getTagId(organizationSlug: string, name: string) {
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT t.id FROM tags t
       JOIN organization o ON o.id = t.organization_id
      WHERE o.slug = $1 AND lower(t.name) = lower($2)`,
    [organizationSlug, name],
  );
  return rows[0]?.id ?? null;
}

/** Inserts a completed visit with exact timestamps, for report arithmetic. */
export async function seedVisit(options: {
  email: string;
  placeId: string;
  checkedInAt: string;
  checkedOutAt: string;
}) {
  await getPool().query(
    `INSERT INTO check_ins
       (id, user_id, place_id, organization_id,
        checked_in_at, checked_out_at, checkout_reason)
     VALUES (
       gen_random_uuid()::text,
       (SELECT id FROM "user" WHERE email = $1),
       $2,
       (SELECT organization_id FROM places WHERE id = $2),
       $3::timestamptz, $4::timestamptz, 'manual'
     )`,
    [
      options.email,
      options.placeId,
      options.checkedInAt,
      options.checkedOutAt,
    ],
  );
}

export async function getCaptureKinds(email: string) {
  const { rows } = await getPool().query<{ kind: string }>(
    `SELECT lc.kind
       FROM location_captures lc
       JOIN check_ins ci ON ci.id = lc.check_in_id
       JOIN "user" u ON u.id = ci.user_id
      WHERE u.email = $1
      ORDER BY lc.created_at`,
    [email],
  );
  return rows.map((row) => row.kind);
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

/**
 * Gets the check-in page to the point of listing places: accept the consent
 * screen if it is showing, then press the button that reads location. Consent
 * lives in a cookie, so a fresh browser context always sees the gate first.
 */
export async function acceptLocationConsent(page: Page) {
  const agree = page.getByRole("button", { name: "Got it" });
  if (await agree.isVisible().catch(() => false)) {
    await agree.click();
  }
  await searchNearbyPlaces(page);
}

/**
 * The check-in page reads location only when asked, so a returning visitor
 * lands on a button rather than a list.
 *
 * The wait matters: granting consent re-renders the panel from the server, so
 * checking visibility straight away would miss a button that is about to exist.
 * Someone already checked in never sees it, hence the swallowed timeout.
 */
export async function searchNearbyPlaces(page: Page) {
  const search = page.getByRole("button", { name: /Find places near me/ });
  await search.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  if (await search.isVisible().catch(() => false)) {
    await search.click();
  }
}

export async function signOut(page: Page) {
  // Signing out lives on the profile page now, not in the header.
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}
