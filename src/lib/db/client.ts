import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../env";
import * as schema from "./schema";

// A single pool is reused across dev hot reloads and warm serverless invocations;
// creating one per module evaluation would exhaust Postgres connections.
const globalForDb = globalThis as unknown as { __pool?: Pool };

const pool =
  globalForDb.__pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;
