CREATE TABLE "source_candidates" (
	"source_candidate_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_candidates_source_candidate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_candidate_ats_kind" text NOT NULL,
	"source_candidate_board" text NOT NULL,
	"source_candidate_company" text NOT NULL,
	"source_candidate_status" text NOT NULL,
	"source_candidate_positions" integer DEFAULT 0 NOT NULL,
	"source_candidate_matching" integer DEFAULT 0 NOT NULL,
	"source_candidate_unknown" integer DEFAULT 0 NOT NULL,
	"source_candidate_examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_candidate_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_candidate_notified_at" timestamp with time zone,
	"source_id" integer,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "source_candidates_ats_kind_board_uq" UNIQUE("source_candidate_ats_kind","source_candidate_board")
);
--> statement-breakpoint
ALTER TABLE "vacancies" DROP CONSTRAINT "vacancies_vacancy_dedup_key_uq";--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "vacancy_external_id" text;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "vacancy_dedup_country" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "source_candidates" ADD CONSTRAINT "source_candidates_source_id_sources_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("source_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_dedup_key_country_uq" UNIQUE("vacancy_dedup_key","vacancy_dedup_country");--> statement-breakpoint
CREATE TRIGGER source_candidates_set_dt_update BEFORE UPDATE ON "source_candidates" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
