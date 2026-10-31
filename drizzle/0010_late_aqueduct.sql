CREATE TABLE "check_in_images" (
	"id" text PRIMARY KEY NOT NULL,
	"check_in_id" text NOT NULL,
	"image_url" text NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "check_in_images" ADD CONSTRAINT "check_in_images_check_in_id_check_ins_id_fk" FOREIGN KEY ("check_in_id") REFERENCES "public"."check_ins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_in_images_check_in_idx" ON "check_in_images" USING btree ("check_in_id","created_at");