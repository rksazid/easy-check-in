/**
 * Promotes an existing account to app-level super admin — the role that may
 * create organizations and assign their admins. Run it once after signing up
 * the first account:
 *
 *   npm run make-super-admin -- you@example.com
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

async function main() {
  const identifier = process.argv[2];

  if (!identifier) {
    throw new Error("Usage: npm run make-super-admin -- <email-or-username>");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Create .env.local first.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query<{
      email: string;
      username: string | null;
    }>(
      `UPDATE "user"
          SET role = 'admin'
        WHERE email = $1 OR username = $1
        RETURNING email, username`,
      [identifier],
    );

    if (rows.length === 0) {
      throw new Error(`No account found for "${identifier}". Sign up first.`);
    }

    for (const row of rows) {
      console.log(`${row.email} (@${row.username}) is now a super admin.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
