ALTER TABLE "rc_events" DROP CONSTRAINT "rc_events_pkey";--> statement-breakpoint
ALTER TABLE "rc_events" ADD CONSTRAINT "rc_events_app_id_id_pk" PRIMARY KEY("app_id","id");--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "test_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rc_events" ADD COLUMN "is_trial_conversion" boolean;--> statement-breakpoint
CREATE INDEX "rc_events_app_original_user" ON "rc_events" USING btree ("app_id","original_app_user_id");--> statement-breakpoint
CREATE INDEX "user_aliases_app_canonical" ON "user_aliases" USING btree ("app_id","canonical_user_id");