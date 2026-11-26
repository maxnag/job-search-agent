---
paths:
  - "packages/db/**"
  - "**/repositories/**"
---

# Database (Drizzle + PostgreSQL)

## Schema

- [ ] Column names are written explicitly (`text('vacancy_title')`); Drizzle's automatic `casing` is not used
- [ ] Every table spreads `timestampColumns()` — `dt_create` defaults to `now()`, `dt_update` is nullable
- [ ] `dt_update` is set by the `set_dt_update()` trigger, never by `$onUpdate()` — so raw SQL updates it too.
      The migration that creates a table ends with
      `CREATE TRIGGER <table>_set_dt_update BEFORE UPDATE ON <table> FOR EACH ROW EXECUTE FUNCTION set_dt_update();`
- [ ] Raw SQL only through the `sql` template (`sql.identifier()` for names) — never string concatenation

## Migrations

- [ ] Generate with a name: `pnpm db:generate --name create-vacancies` — a random name is never kept
- [ ] Read the generated SQL before applying it: a renamed column may come out as drop + add, losing data
- [ ] Before a feature branch is merged, its unreleased migrations are squashed into one: drop the branch's tables and
      their rows in `drizzle.__drizzle_migrations` on the local databases, delete the files, `pnpm db:generate` once.
      Migrations already in `main` are never touched
- [ ] An applied migration never changes; a fix is a new migration. There is no `down` — forward only,
      `pg_dump` before a risky one (ADR-014)
- [ ] What the schema cannot describe (extensions, functions, triggers) goes into
      `pnpm db:generate --custom --name <what-it-does>` — an empty SQL file in the same chain, written by hand
- [ ] Migrations never run on application start — only `pnpm db:migrate`
- [ ] Tests use `job_agent_test` (`pnpm db:migrate:test`), never the dev database

## Seeds

- [ ] Reference data (`src/seeds/reference`) is a typed TS file in git, the source of truth, written with
      `upsertRows()` — `INSERT … ON CONFLICT DO UPDATE` on the natural key, so `pnpm db:seed` runs any number of times
- [ ] Settings the owner tunes by hand (`llm_settings`) are seeded with `insertMissingRows()` — `ON CONFLICT DO NOTHING`;
      the seed gives defaults and never overwrites a tuned row
- [ ] Demo data (`src/seeds/dev`) is fictional only (the repository is public); `pnpm db:seed:dev` refuses
      `NODE_ENV=production`
- [ ] Filter rules (config in code) and secrets / Telegram chat ids (env) are never stored in the database

## Scripts

- [ ] The standalone scripts (`migrate`, `seeds`) have no `ConfigService`: they read the environment once,
      through the Zod schema in `src/env/db-env.schema.ts`, and fail naming the invalid keys
