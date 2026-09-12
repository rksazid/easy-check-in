CREATE TABLE "join_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	CONSTRAINT "join_requests_status_check" CHECK ("join_requests"."status" IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_one_pending_per_org" ON "join_requests" USING btree ("user_id","organization_id") WHERE "join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "join_requests_org_status_idx" ON "join_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "join_requests_user_idx" ON "join_requests" USING btree ("user_id");