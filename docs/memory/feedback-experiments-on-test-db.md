---
name: feedback-experiments-on-test-db
description: Experiments and verification runs go to the test database (job_agent_test), never the dev one — dev is working data
metadata:
  type: feedback
---

Every experiment, probe or verification run that writes data uses the test database `job_agent_test`
(`DATABASE_URL` overridden with the value of `DATABASE_URL_TEST`) and a scratch `STORAGE_DIR` — never the dev
database `job_agent` and never the real `storage/`. The dev database holds the owner's working data (profiles,
resumes, settings tuned by hand).

**Why:** in phase 2 the verification of `cv:import` created extra resume versions and temporarily changed
`llm_settings` in the dev database, mixing test artifacts into working data.

**How to apply:** run commands as `DATABASE_URL=<test url> STORAGE_DIR=<scratchpad> pnpm cv:import …` (process env
wins over `--env-file`); migrate the test database with `pnpm db:migrate:test`; change dev data only when the owner
asks for it. Related: [[feedback-commit-only-on-command]].
