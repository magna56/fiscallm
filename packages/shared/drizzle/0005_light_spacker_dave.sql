CREATE TABLE "rc_imports" (
	"app_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"project_id" text NOT NULL,
	"key_cipher" text,
	"cursor" text,
	"cutoff" timestamp with time zone NOT NULL,
	"customers_done" integer DEFAULT 0 NOT NULL,
	"events_imported" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "rc_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rc_imports" ADD CONSTRAINT "rc_imports_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;