ALTER TABLE "check_ins" ADD COLUMN "is_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ADD COLUMN "status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ADD COLUMN "rejected_by" text;--> statement-breakpoint
ALTER TABLE "check_ins" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "check_ins" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "allow_manual_check_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_status_check" CHECK ("check_ins"."status" IN ('approved', 'rejected'));