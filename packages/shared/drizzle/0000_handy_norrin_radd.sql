CREATE TABLE "ai_events" (
	"app_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"cached_tokens" bigint,
	"cost_usd" numeric(18, 8),
	"cost_source" text NOT NULL,
	"feature" text,
	CONSTRAINT "ai_events_app_id_id_pk" PRIMARY KEY("app_id","id")
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ingest_key_hash" text NOT NULL,
	"rc_webhook_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_ingest_key_hash_unique" UNIQUE("ingest_key_hash")
);
--> statement-breakpoint
CREATE TABLE "daily_user_cost" (
	"app_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"cost_usd" numeric(18, 8) DEFAULT '0' NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_user_cost_app_id_user_id_day_pk" PRIMARY KEY("app_id","user_id","day")
);
--> statement-breakpoint
CREATE TABLE "model_prices" (
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"effective_from" date NOT NULL,
	"input_per_mtok" numeric(18, 8) NOT NULL,
	"output_per_mtok" numeric(18, 8) NOT NULL,
	"cached_per_mtok" numeric(18, 8),
	CONSTRAINT "model_prices_provider_model_effective_from_pk" PRIMARY KEY("provider","model","effective_from")
);
--> statement-breakpoint
CREATE TABLE "rc_events" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"type" text NOT NULL,
	"app_user_id" text,
	"original_app_user_id" text,
	"product_id" text,
	"period_type" text,
	"store" text,
	"environment" text,
	"price_usd" numeric(18, 8),
	"tax_pct" numeric(7, 4),
	"commission_pct" numeric(7, 4),
	"net_usd" numeric(18, 8),
	"purchased_at" timestamp with time zone,
	"expiration_at" timestamp with time zone,
	"event_ts" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"app_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"state" text NOT NULL,
	"product_id" text,
	"trial_started_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"net_revenue_usd" numeric(18, 8) DEFAULT '0' NOT NULL,
	CONSTRAINT "subscribers_app_id_user_id_pk" PRIMARY KEY("app_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_aliases" (
	"app_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"canonical_user_id" text NOT NULL,
	CONSTRAINT "user_aliases_app_id_alias_pk" PRIMARY KEY("app_id","alias")
);
--> statement-breakpoint
ALTER TABLE "ai_events" ADD CONSTRAINT "ai_events_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_user_cost" ADD CONSTRAINT "daily_user_cost_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_events" ADD CONSTRAINT "rc_events_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_aliases" ADD CONSTRAINT "user_aliases_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_events_app_user_ts" ON "ai_events" USING btree ("app_id","user_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_user_cost_app_day_user" ON "daily_user_cost" USING btree ("app_id","day","user_id");--> statement-breakpoint
CREATE INDEX "rc_events_app_user" ON "rc_events" USING btree ("app_id","app_user_id");