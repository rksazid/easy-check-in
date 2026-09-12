import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

/** Every domain timestamp is stored in UTC and rendered in the viewer's zone. */
const utcTimestamp = (name: string) => timestamp(name, { withTimezone: true });

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

/**
 * Per-organization configuration. Kept as real columns rather than the
 * organization plugin's `metadata` JSON because report month boundaries need
 * the timezone inside SQL.
 */
export const organizationSettings = pgTable("organization_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
});

export const JOIN_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

/**
 * A user asking to join an organization. The organization plugin only models the
 * opposite direction (an admin inviting a user), so this is ours.
 */
export const joinRequests = pgTable(
  "join_requests",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    message: text("message"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    decidedAt: utcTimestamp("decided_at"),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // One open request per person per organization; resolved ones may pile up so
    // that a rejected applicant can apply again later.
    uniqueIndex("join_requests_one_pending_per_org")
      .on(table.userId, table.organizationId)
      .where(sql`${table.status} = 'pending'`),
    index("join_requests_org_status_idx").on(table.organizationId, table.status),
    index("join_requests_user_idx").on(table.userId),
    check(
      "join_requests_status_check",
      sql`${table.status} IN ('pending', 'approved', 'rejected')`,
    ),
  ],
);
