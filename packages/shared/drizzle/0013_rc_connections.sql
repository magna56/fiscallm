CREATE TABLE "rc_connections" (
	"app_id" uuid PRIMARY KEY NOT NULL,
	"project_id" text,
	"project_name" text,
	"access_token_cipher" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_cipher" text NOT NULL,
	"webhook_integration_id" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rc_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rc_connections" ADD CONSTRAINT "rc_connections_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;