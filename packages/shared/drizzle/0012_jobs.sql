CREATE TABLE "jobs" (
	"app_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"status_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_app_id_job_id_pk" PRIMARY KEY("app_id","job_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_events" ADD COLUMN "job_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_app_status_at" ON "jobs" USING btree ("app_id","status_at");--> statement-breakpoint
CREATE INDEX "ai_events_app_job" ON "ai_events" USING btree ("app_id","job_id");