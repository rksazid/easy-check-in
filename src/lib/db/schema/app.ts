import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { member, organization, user } from "./auth";

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
export const DEFAULT_FORGOT_CHECKOUT_HOURS = 12;

export const organizationSettings = pgTable("organization_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  /**
   * How long a visit may stay open before it is closed as forgotten. This is
   * about keeping reports honest, not tracking: nothing watches the user.
   */
  forgotCheckoutHours: integer("forgot_checkout_hours")
    .notNull()
    .default(DEFAULT_FORGOT_CHECKOUT_HOURS),
  /**
   * A Slack Incoming Webhook, pasted in by an admin. Treated as a secret: it is
   * never sent back to the browser in full, only ever masked.
   *
   * A webhook rather than a Slack app because it needs no OAuth, no token to
   * rotate, no app review, and each organization points at its own channel
   * without anything shared between them.
   */
  slackWebhookUrl: text("slack_webhook_url"),
  /** Post when somebody is waiting on an admin, as well as the daily digest. */
  slackNotifyEvents: boolean("slack_notify_events").notNull().default(true),
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

export const PLACE_STATUSES = ["pending", "approved", "rejected"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

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
    /** Optional photo of the place (front facade, entrance, building). */
    imageUrl: text("image_url"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    /** How close someone must be to check in here. */
    radiusM: integer("radius_m").notNull().default(DEFAULT_RADIUS_M),
    /**
     * Any member may propose a place; an admin decides whether it counts.
     * Separate from `isActive`, because archiving a place that has served its
     * purpose is a different act from rejecting a proposal.
     */
    status: text("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: utcTimestamp("reviewed_at"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("places_org_active_idx").on(table.organizationId, table.isActive),
    index("places_org_status_idx").on(table.organizationId, table.status),
    check(
      "places_status_check",
      sql`${table.status} IN ('pending', 'approved', 'rejected')`,
    ),
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

export const CHECKOUT_REASONS = ["manual", "auto_forgot", "admin"] as const;
export type CheckoutReason = (typeof CHECKOUT_REASONS)[number];

/**
 * One visit to a place. `checked_out_at IS NULL` means the visit is still open;
 * a partial unique index on that condition is what stops a person being checked
 * in to two places at once.
 */
export const checkIns = pgTable(
  "check_ins",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id),
    /** Denormalised from the place so reports never join through it. */
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    checkedInAt: utcTimestamp("checked_in_at").notNull().defaultNow(),
    checkedOutAt: utcTimestamp("checked_out_at"),
    checkoutReason: text("checkout_reason"),
  },
  (table) => [
    uniqueIndex("check_ins_one_open_per_user")
      .on(table.userId)
      .where(sql`${table.checkedOutAt} IS NULL`),
    index("check_ins_org_started_idx").on(
      table.organizationId,
      table.checkedInAt,
    ),
    index("check_ins_user_started_idx").on(table.userId, table.checkedInAt),
    index("check_ins_place_idx").on(table.placeId),
    check(
      "check_ins_interval_check",
      sql`${table.checkedOutAt} IS NULL OR ${table.checkedOutAt} >= ${table.checkedInAt}`,
    ),
    check(
      "check_ins_reason_check",
      sql`${table.checkoutReason} IS NULL
          OR ${table.checkoutReason} IN ('manual', 'auto_forgot', 'admin')`,
    ),
  ],
);

export const CAPTURE_KINDS = ["check_in", "check_out", "manual"] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];

/**
 * A position the user deliberately submitted: at check-in, at check-out, or by
 * pressing "Store location". Nothing here samples location on its own, so this
 * table records deliberate acts rather than a movement trail.
 */
export const locationCaptures = pgTable(
  "location_captures",
  {
    id: id(),
    checkInId: text("check_in_id")
      .notNull()
      .references(() => checkIns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    /** Radius of uncertainty the browser reported, in metres. */
    accuracyM: doublePrecision("accuracy_m"),
    /** Distance from the place. Computed on the server, never taken from input. */
    distanceM: doublePrecision("distance_m").notNull(),
    inside: boolean("inside").notNull(),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("location_captures_check_in_idx").on(
      table.checkInId,
      table.createdAt,
    ),
    check(
      "location_captures_kind_check",
      sql`${table.kind} IN ('check_in', 'check_out', 'manual')`,
    ),
  ],
);

/**
 * Photos attached to a check-in (e.g. proof of attendance, workout photos, desk setup).
 * A check-in may have multiple photos uploaded during or after the visit.
 */
export const checkInImages = pgTable(
  "check_in_images",
  {
    id: id(),
    checkInId: text("check_in_id")
      .notNull()
      .references(() => checkIns.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    caption: text("caption"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("check_in_images_check_in_idx").on(
      table.checkInId,
      table.createdAt,
    ),
  ],
);

/**
 * A label an organization puts on its people, usually the project or team they
 * are on at the moment. Tags belong to one organization and mean nothing
 * outside it, so the same person can be "Backend" in one and "Night shift" in
 * another.
 */
export const tags = pgTable(
  "tags",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("slate"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // Case-insensitive, so "Backend" and "backend" cannot both exist and leave
    // people guessing which one to use.
    uniqueIndex("tags_unique_name_per_org").on(
      table.organizationId,
      sql`lower(${table.name})`,
    ),
    index("tags_org_idx").on(table.organizationId),
  ],
);

/**
 * Which tags a membership carries. Keyed on the membership rather than the user,
 * which is what keeps a person's tags in one organization out of another.
 */
export const memberTags = pgTable(
  "member_tags",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    assignedAt: utcTimestamp("assigned_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.tagId] }),
    index("member_tags_tag_idx").on(table.tagId),
  ],
);
