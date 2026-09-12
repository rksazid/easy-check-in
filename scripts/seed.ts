/**
 * Inserts the reference data the app needs to function. Safe to re-run: every
 * statement is a no-op when the row already exists.
 *
 *   npm run db:seed
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

const PLACE_TYPES = [
  { name: "Office", icon: "building-2", sortOrder: 10 },
  { name: "Gym", icon: "dumbbell", sortOrder: 20 },
  { name: "Co-working space", icon: "users", sortOrder: 30 },
  { name: "Warehouse", icon: "package", sortOrder: 40 },
  { name: "Store", icon: "store", sortOrder: 50 },
  { name: "Clinic", icon: "stethoscope", sortOrder: 60 },
  { name: "Site", icon: "hard-hat", sortOrder: 70 },
  { name: "Other", icon: "map-pin", sortOrder: 900 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Create .env.local first.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const type of PLACE_TYPES) {
      await pool.query(
        `INSERT INTO place_types (name, icon, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE
           SET icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order`,
        [type.name, type.icon, type.sortOrder],
      );
    }

    const { rows } = await pool.query<{ count: string }>(
      "SELECT count(*) FROM place_types",
    );
    console.log(`Seeded place types (${rows[0].count} total).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
