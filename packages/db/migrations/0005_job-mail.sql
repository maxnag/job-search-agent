CREATE TABLE "job_mail_messages" (
	"job_mail_message_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_mail_messages_job_mail_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" integer,
	"job_mail_message_key" text NOT NULL,
	"job_mail_message_provider" text NOT NULL,
	"job_mail_message_provider_id" text NOT NULL,
	"job_mail_message_sender_domain" text NOT NULL,
	"job_mail_message_received_at" timestamp with time zone NOT NULL,
	"job_mail_message_kind" text NOT NULL,
	"job_mail_message_status" text NOT NULL,
	"job_mail_message_links" integer DEFAULT 0 NOT NULL,
	"job_mail_message_positions" integer DEFAULT 0 NOT NULL,
	"job_mail_message_created" integer DEFAULT 0 NOT NULL,
	"job_mail_message_error" text,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "job_mail_messages_key_uq" UNIQUE("job_mail_message_key")
);
--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "vacancy_text_url" text;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "vacancy_text_searched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "vacancy_text_searches" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_mail_messages" ADD CONSTRAINT "job_mail_messages_source_id_sources_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("source_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_mail_messages_received_at_idx" ON "job_mail_messages" USING btree ("job_mail_message_received_at");--> statement-breakpoint
CREATE TRIGGER job_mail_messages_set_dt_update BEFORE UPDATE ON "job_mail_messages" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
