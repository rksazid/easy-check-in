CREATE TABLE "check_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"place_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_out_at" timestamp with time zone,
	"checkout_reason" text,
	CONSTRAINT "check_ins_interval_check" CHECK ("check_ins"."checked_out_at" IS NULL OR "check_ins"."checked_out_at" >= "check_ins"."checked_in_at"),
	CONSTRAINT "check_ins_reason_check" CHECK ("check_ins"."checkout_reason" IS NULL
          OR "check_ins"."checkout_reason" IN ('manual', 'auto_forgot', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "location_captures" (
	"id" text PRIMARY KEY NOT NULL,
	"check_in_id" text NOT NULL,
	"kind" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_m" double precision,
	"distance_m" double precision NOT NULL,
	"inside" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_captures_kind_check" CHECK ("location_captures"."kind" IN ('check_in', 'check_out', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "forgot_checkout_hours" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_captures" ADD CONSTRAINT "location_captures_check_in_id_check_ins_id_fk" FOREIGN KEY ("check_in_id") REFERENCES "public"."check_ins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_one_open_per_user" ON "check_ins" USING btree ("user_id") WHERE "check_ins"."checked_out_at" IS NULL;--> statement-breakpoint
CREATE INDEX "check_ins_org_started_idx" ON "check_ins" USING btree ("organization_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "check_ins_user_started_idx" ON "check_ins" USING btree ("user_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "check_ins_place_idx" ON "check_ins" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "location_captures_check_in_idx" ON "location_captures" USING btree ("check_in_id","created_at");