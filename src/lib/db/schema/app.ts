import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
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

/**
 * The kinds of place an organization can register. Seeded by `npm run db:seed`
 * and shared across organizations, so the admin picks from a list rather than
 * inventing a category per place.
 */
export const placeTypes = pgTable("place_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(100),
});

export const DEFAULT_RADIUS_M = 150;
export const MIN_RADIUS_M = 25;
export const MAX_RADIUS_M = 2000;

/** A physical location people check in at. */
export const places = pgTable(
  "places",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    placeTypeId: integer("place_type_id")
      .notNull()
      .references(() => placeTypes.id),
    name: text("name").notNull(),
    /** Reverse-geocoded when the pin was dropped; a label, never authoritative. */
    address: text("address"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    /** How close someone must be to check in here. */
    radiusM: integer("radius_m").notNull().default(DEFAULT_RADIUS_M),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("places_org_active_idx").on(table.organizationId, table.isActive),
    check(
      "places_latitude_check",
      sql`${table.latitude} BETWEEN -90 AND 90`,
    ),
    check(
      "places_longitude_check",
      sql`${table.longitude} BETWEEN -180 AND 180`,
    ),
    // sql.raw, because an interpolated number becomes a bind parameter and DDL
    // cannot carry those.
    check(
      "places_radius_check",
      sql`${table.radiusM} BETWEEN ${sql.raw(String(MIN_RADIUS_M))} AND ${sql.raw(String(MAX_RADIUS_M))}`,
    ),
  ],
);
