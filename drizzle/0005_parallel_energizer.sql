ALTER TABLE "places" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
--> Places that existed before approvals were introduced were created by admins
--> and are already in use, so they start out approved rather than pending.
UPDATE "places" SET "status" = 'approved';--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "places_org_status_idx" ON "places" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_status_check" CHECK ("places"."status" IN ('pending', 'approved', 'rejected'));