CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_dt_update() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.dt_update = now();
  RETURN NEW;
END;
$$;
