CREATE TABLE "sources" (
	"source_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sources_source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"source_fetch_mode" text DEFAULT 'html' NOT NULL,
	"source_is_active" boolean DEFAULT true NOT NULL,
	"source_status" text DEFAULT 'ok' NOT NULL,
	"source_last_scan_at" timestamp with time zone,
	"source_last_error" text,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "sources_source_url_uq" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "vacancies" (
	"vacancy_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vacancies_vacancy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" integer NOT NULL,
	"vacancy_url" text NOT NULL,
	"vacancy_title" text NOT NULL,
	"vacancy_company" text NOT NULL,
	"vacancy_dedup_key" text NOT NULL,
	"vacancy_country" text,
	"vacancy_city" text,
	"vacancy_work_mode" text,
	"vacancy_role_family" text,
	"vacancy_level" text,
	"vacancy_stage" text DEFAULT 'listed' NOT NULL,
	"vacancy_skip_reason" text,
	"vacancy_text_hash" text,
	"vacancy_data" jsonb,
	"vacancy_first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vacancy_last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vacancy_closed_at" timestamp with time zone,
	"vacancy_checked_at" timestamp with time zone,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "vacancies_vacancy_url_uq" UNIQUE("vacancy_url"),
	CONSTRAINT "vacancies_vacancy_dedup_key_uq" UNIQUE("vacancy_dedup_key")
);
--> statement-breakpoint
CREATE TABLE "vacancy_actions" (
	"vacancy_action_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vacancy_actions_vacancy_action_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vacancy_id" integer NOT NULL,
	"vacancy_action_kind" text NOT NULL,
	"vacancy_action_message_id" integer NOT NULL,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vacancy_matches" (
	"vacancy_match_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vacancy_matches_vacancy_match_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vacancy_id" integer NOT NULL,
	"resume_id" integer NOT NULL,
	"vacancy_match_verdict" text NOT NULL,
	"vacancy_match_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vacancy_match_notified_at" timestamp with time zone,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "vacancy_matches_vacancy_resume_uq" UNIQUE("vacancy_id","resume_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "profile_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_source_id_sources_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("source_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_actions" ADD CONSTRAINT "vacancy_actions_vacancy_id_vacancies_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("vacancy_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_matches" ADD CONSTRAINT "vacancy_matches_vacancy_id_vacancies_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("vacancy_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_matches" ADD CONSTRAINT "vacancy_matches_resume_id_resumes_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("resume_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vacancies_source_id_idx" ON "vacancies" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "vacancy_actions_vacancy_id_idx" ON "vacancy_actions" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "vacancy_matches_resume_id_idx" ON "vacancy_matches" USING btree ("resume_id");--> statement-breakpoint
CREATE TRIGGER sources_set_dt_update BEFORE UPDATE ON "sources" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
--> statement-breakpoint
CREATE TRIGGER vacancies_set_dt_update BEFORE UPDATE ON "vacancies" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
--> statement-breakpoint
CREATE TRIGGER vacancy_matches_set_dt_update BEFORE UPDATE ON "vacancy_matches" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
--> statement-breakpoint
CREATE TRIGGER vacancy_actions_set_dt_update BEFORE UPDATE ON "vacancy_actions" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
