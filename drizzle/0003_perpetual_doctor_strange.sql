CREATE TABLE "place_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "place_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"place_type_id" integer NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_m" integer DEFAULT 150 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_latitude_check" CHECK ("places"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "places_longitude_check" CHECK ("places"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "places_radius_check" CHECK ("places"."radius_m" BETWEEN 25 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_place_type_id_place_types_id_fk" FOREIGN KEY ("place_type_id") REFERENCES "public"."place_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "places_org_active_idx" ON "places" USING btree ("organization_id","is_active");