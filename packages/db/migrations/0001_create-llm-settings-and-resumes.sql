CREATE TABLE "llm_settings" (
	"llm_setting_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "llm_settings_llm_setting_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"llm_setting_provider" text NOT NULL,
	"llm_setting_step" text NOT NULL,
	"llm_setting_model" text NOT NULL,
	"llm_setting_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "llm_settings_provider_step_uq" UNIQUE("llm_setting_provider","llm_setting_step")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"profile_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "profiles_profile_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"profile_name" text NOT NULL,
	"profile_core_skill_kinds" text[] DEFAULT ARRAY['programming_language']::text[] NOT NULL,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "profiles_profile_name_uq" UNIQUE("profile_name")
);
--> statement-breakpoint
CREATE TABLE "resume_languages" (
	"resume_language_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resume_languages_resume_language_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"resume_id" integer NOT NULL,
	"resume_language_code" text NOT NULL,
	"resume_language_level" text NOT NULL,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "resume_languages_resume_code_uq" UNIQUE("resume_id","resume_language_code")
);
--> statement-breakpoint
CREATE TABLE "resume_skills" (
	"resume_skill_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resume_skills_resume_skill_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"resume_id" integer NOT NULL,
	"resume_skill_key" text NOT NULL,
	"resume_skill_name" text NOT NULL,
	"resume_skill_kind" text NOT NULL,
	"resume_skill_years" real,
	"resume_skill_is_unknown" boolean DEFAULT false NOT NULL,
	"resume_skill_is_claimed" boolean DEFAULT false NOT NULL,
	"resume_skill_is_hidden" boolean DEFAULT false NOT NULL,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "resume_skills_resume_key_uq" UNIQUE("resume_id","resume_skill_key")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"resume_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resumes_resume_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"profile_id" integer NOT NULL,
	"resume_file_name" text NOT NULL,
	"resume_file_hash" text NOT NULL,
	"resume_file_path" text,
	"resume_text" text NOT NULL,
	"resume_data" jsonb NOT NULL,
	"resume_experience_years" real,
	"resume_llm_model" text NOT NULL,
	"resume_is_current" boolean DEFAULT false NOT NULL,
	"dt_create" timestamp with time zone DEFAULT now() NOT NULL,
	"dt_update" timestamp with time zone,
	CONSTRAINT "resumes_profile_file_hash_uq" UNIQUE("profile_id","resume_file_hash")
);
--> statement-breakpoint
ALTER TABLE "resume_languages" ADD CONSTRAINT "resume_languages_resume_id_resumes_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("resume_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_resume_id_resumes_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("resume_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_profile_id_profiles_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("profile_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resumes_profile_current_uq" ON "resumes" USING btree ("profile_id") WHERE "resumes"."resume_is_current";--> statement-breakpoint
CREATE TRIGGER llm_settings_set_dt_update BEFORE UPDATE ON "llm_settings" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
--> statement-breakpoint
CREATE TRIGGER profiles_set_dt_update BEFORE UPDATE ON "profiles" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
--> statement-breakpoint
CREATE TRIGGER resumes_set_dt_update BEFORE UPDATE ON "resumes" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
--> statement-breakpoint
CREATE TRIGGER resume_skills_set_dt_update BEFORE UPDATE ON "resume_skills" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
--> statement-breakpoint
CREATE TRIGGER resume_languages_set_dt_update BEFORE UPDATE ON "resume_languages" FOR EACH ROW EXECUTE FUNCTION set_dt_update();
