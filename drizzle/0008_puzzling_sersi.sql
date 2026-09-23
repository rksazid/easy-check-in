ALTER TABLE "organization_settings" ADD COLUMN "slack_webhook_url" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "slack_notify_events" boolean DEFAULT true NOT NULL;