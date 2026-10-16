CREATE TABLE "app_price_overrides" (
	"app_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text DEFAULT '*' NOT NULL,
	"effective_from" date NOT NULL,
	"discount_pct" numeric(7, 4),
	"input_per_mtok" numeric(18, 8),
	"output_per_mtok" numeric(18, 8),
	"cached_per_mtok" numeric(18, 8),
	"cache_write_per_mtok" numeric(18, 8),
	CONSTRAINT "app_price_overrides_app_id_provider_model_effective_from_pk" PRIMARY KEY("app_id","provider","model","effective_from")
);
--> statement-breakpoint
ALTER TABLE "app_price_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_events" ADD COLUMN "cache_write_tokens" bigint;--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "cache_write_per_mtok" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "long_context_threshold" integer;--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "long_input_per_mtok" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "long_output_per_mtok" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "long_cached_per_mtok" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "long_cache_write_per_mtok" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "app_price_overrides" ADD CONSTRAINT "app_price_overrides_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;