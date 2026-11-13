CREATE TABLE "app_sources" (
	"app_id" uuid NOT NULL,
	"source" text NOT NULL,
	"key_cipher" text NOT NULL,
	"synced_until" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_sources_app_id_source_pk" PRIMARY KEY("app_id","source")
);
--> statement-breakpoint
ALTER TABLE "app_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_events" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "app_sources" ADD CONSTRAINT "app_sources_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;