ALTER TABLE "ai_events" ADD COLUMN "units" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "ai_events" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "ai_events" ADD COLUMN "variant" text;--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "unit_prices" jsonb;