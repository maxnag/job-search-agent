CREATE TABLE "vacancy_messages" (
	"vacancy_message_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vacancy_messages_vacancy_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vacancy_id" integer NOT NULL,
	"vacancy_message_telegram_id" integer NOT NULL,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "vacancy_messages_vacancy_telegram_uq" UNIQUE("vacancy_id","vacancy_message_telegram_id")
);
--> statement-breakpoint
ALTER TABLE "vacancy_actions" ADD COLUMN "vacancy_action_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacancy_messages" ADD CONSTRAINT "vacancy_messages_vacancy_id_vacancies_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("vacancy_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER vacancy_messages_set_dt_update BEFORE UPDATE ON "vacancy_messages" FOR EACH ROW EXECUTE FUNCTION set_dt_update();--> statement-breakpoint
UPDATE "vacancy_actions" SET "vacancy_action_synced_at" = "dt_create";
