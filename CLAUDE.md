# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Last synced commit:** `89ee529` (jobs-db MCP server)
> Run `git log 89ee529..HEAD --stat` to see what changed since this doc was last updated.
> Plus run `git status --short` and also include these changes when docs update.
> Keep this file under 200 lines — detail belongs in `docs/`, `.claude/rules/` (path-scoped) or a skill.

# Working with Claude - CRITICAL RULES

**⚠️ NEVER change the repository working tree or git history without explicit user confirmation first.** Exemptions (plan file, auto-memory, scratchpad, lint/format `:fix` scripts) and what one confirmation covers: [.claude/rules/project-knowledge.md](.claude/rules/project-knowledge.md).

**Languages:** code, JSDoc, docs, rules and commit messages are in **English**. Plans in `.claude/plans/` and the conversation with the user are in **Russian**.

### Workflow Requirements

When the user asks about a problem or requests changes:

1. ✅ **Analyze** - Read files, investigate the issue, understand the codebase
2. ✅ **Propose** - Explain the solution clearly with specific details
3. ✅ **Ask** - Request explicit confirmation: "Reply _do it_ to apply these changes."
4. ⏸️ **Wait** - Wait for user response — exact phrases only: `"do it"`, `"go ahead"`, `"you can do it"`
5. ✅ **Execute** - Only after confirmation, make the changes

### Plan creation guide

All plans are saved in [.claude/plans](.claude/plans) — where a new plan goes, how plans are found, closed and moved into `archive/`: [Plans folder layout](.claude/rules/workflow.md#plans-folder-layout)

Plans are written in **Russian**; the head keys below (`Status`, `Created`, …) and code identifiers stay in English.

Name of the file – the example "2026-11-23-mvp-digest-pipeline.md"
- date
- topic

Head of the plan — each point MUST be its own Markdown bullet-list item (a line starting with `- `). Do NOT use bare lines: Markdown collapses adjacent non-blank lines into a single paragraph. Format exactly like the bulleted list below:
- Name of the plan, like "Plan: MVP — пайплайн дайджеста"
- Status, like "Status: ✅ Implemented" — one of: ✅ Implemented, ⏸️ In Progress, ⚠️ Blocked, ❌ Cancelled, Created
- Date of creation, like "Created: 2026-11-23"
- Date of implementation, like "Implemented: 2026-11-24"
- The git branch name
- Author, like "Author: Claude Opus v5.5" — the model used for creation, with the version
- If a different model reviews and changes the plan, add it as co-author (same pattern as the author)

Then the context of the plan.

### Example Interaction

❌ **WRONG:**
```
User: "Fix the dedup bug"
Claude: [reads the file, immediately edits it]
```

✅ **CORRECT:**
```
User: "Fix the dedup bug"
Claude: [reads the file]
Claude: "Company names are normalized after the comparison, not before...
        Reply "do it" to update vacancy-dedup.service.ts."
User: "go ahead"
Claude: [now edits the file]
```

---

## Project Overview

Job Search Agent collects vacancies from career pages and from job-alert e-mails, extracts them into structured JSON with an LLM, matches them with the owner's resume in plain code and sends a Telegram card for each one that fits. **The human decides whether a vacancy fits — the agent never does.** It is both a real job-search tool and a portfolio project (AI agents, MCP, queues).

**Target market:** Israel (priority — whole country, full-time / hybrid) and Ukraine (remote). Working language English; vacancies requiring Hebrew are filtered out.

**Tech Stack:** Node.js 24 LTS, NestJS 12, TypeScript, pnpm workspaces monorepo, BullMQ 6 + Redis 8.10, PostgreSQL 18 + pgvector (JSONB), Ollama (Qwen3 9B / 27B), Playwright + cheerio, IMAP (`imapflow`, read-only by code), Telegram bot (grammY), MCP servers over stdio, Drizzle ORM, Zod 4, Vitest, pino → Loki + Grafana. LLM: Ollama on the Mac or Claude Haiku 5.5 in the cloud — chosen by `LLM_PROVIDER`, never by code.

**Runs on:** the owner's Mac (Apple Silicon). NestJS, MCP servers, Playwright and Ollama run on the host; Postgres, Redis, Loki and Grafana run in Docker. Development currently happens on Linux with `LLM_PROVIDER=anthropic`.

**Phases, progress and open questions** live in the master plan in `.claude/plans/` — never in this file or in `docs/`.

## Commands

```bash
docker compose up -d                   # postgres, redis, loki, grafana (http://localhost:3003)
pnpm install                           # respects minimumReleaseAge (7 days)
pnpm db:migrate && pnpm db:migrate:test  # apply migrations to the dev and the test database
pnpm db:seed                           # reference data and default llm_settings, idempotent; db:seed:dev — demo data
# every command below: --help for its options and examples, needs neither the database nor Redis
pnpm cv:import <file> --profile <name> # resume → new version of a profile (PDF); prints the profile, re-matches vacancies
pnpm sources:add <url> [--name <company>]  # add a career page or an ATS board (any link to it); a board is read once
pnpm sources:discover [--dry-run]      # find ATS boards by web search, cards to Telegram; --dry-run stores nothing
pnpm sources:scan [--source <id>] [--force]  # scan career pages now; the running API extracts what was queued
pnpm vacancies:report [options]        # positions with stage and reason; filters by source, stage, verdict, reason, …
pnpm job-mail:read [--hours n] [--dry-run]  # read the job-alert e-mails now; --dry-run shows the kinds and links, stores nothing
pnpm db:generate --name <what-it-does> # SQL migration from the schema; add --custom for a hand-written one
pnpm api:dev                           # tsc -b --watch + API with node --watch + prompt copy (Bull Board at BULL_BOARD_PATH)
pnpm api:start                         # build, then the API without watch (the owner's Mac)
pnpm mcp:jobs-db                       # build, then the jobs-db MCP server on stdio — Claude Code starts it from .mcp.json
pnpm build                             # tsc -b over the project references — every package and app
pnpm api:build                         # the API and the packages it uses, with its prompts
pnpm typecheck                         # tsc -b, then tsc --noEmit per package (specs included)
pnpm lint:fix && pnpm prettier:fix
pnpm test                              # Vitest unit tests; env from .env.example, never from .env
pnpm test:e2e                          # repositories against job_agent_test (db:migrate:test first)
npx playwright install chromium        # once per machine; no build for the Linux → RENDER_BROWSER_CHANNEL=chrome
ollama pull qwen3:9b && ollama pull qwen3:27b  # Mac only, then LLM_PROVIDER=ollama
```

**Releases:** commits and PR titles follow Conventional Commits; release-please keeps a release PR open on `main`.
Merging it bumps every `package.json`, writes `CHANGELOG.md`, tags `vX.Y.Z` and pushes the image
`ghcr.io/maxnag/job-search-agent-api` after a Trivy scan. Versions are never edited by hand.

## Architecture

```
career pages ─► search queue ─► (html | rendered) ─► LLM picks links ─► screen (code) ─► links ─┐
job alerts   ─► email queue  ─► (LLM tells the kind by headers) ─► LLM picks links ─► screen (code) ─► links ─┤
                                                                                                 ▼
           extract queue (LLM → JSON) ─► match with the current resume (code) ─► notify queue ─► Telegram card ─► human
```

- **Resume first:** `cv:import` turns a resume into a profile version (skills by kind and years, experience, spoken languages); the latest version is the source of truth, vacancies are compared with it by code
- **Hybrid design:** an agent only where the path differs every time (navigating a site, reading an e-mail); everything else is ordinary code. The LLM understands text and extracts data — it **never scores or judges a vacancy**
- **Both channels converge** into one extraction step and one set of filters
- **Career pages** are rows of `sources`, fetched by code — `html` or `rendered` (headless Playwright, scrolled), a numbered list followed page after page by code; the crawler obeys `robots.txt`, makes one request at a time per site with random pauses, and stops a source on 403 / 429 / captcha (ADR-017). The LLM picks vacancy links by number, code screens them by the profiles' preferences before any extraction (ADR-018)
- **ATS boards** (Comeet, Greenhouse, Lever) are `ats` sources read through their public APIs by the same crawler, a shorter pause for an API; country and work mode come from the system, the LLM reads only titles (ADR-021)
- **Discovery** builds web search queries (Brave) from the profiles, keeps only the board a result URL leads to — results are never stored — and offers a board with fitting positions as a Telegram card; the owner adds or ignores it
- **Browser agent** only for sites whose list answers a form: it drives Playwright once and saves a **recipe**; later runs replay it without an LLM
- **Web text is untrusted** (ADR-020): LLM steps that read it have no tools, the text is fenced in the prompt, hidden elements are dropped, fields are clipped, and no request reaches a private address
- **Job-alert e-mails** (ADR-022): every `JOB_MAIL_INTERVAL_MINUTES` the last `JOB_MAIL_LOOKBACK_HOURS` of the mailbox are read over IMAP, read-only, each e-mail once (`job_mail_messages`, keyed by `Message-ID`). The LLM tells the kind from the headers only; only a job alert has its body fetched and is read like a listing — it closes nothing. Its sender domain is a `job_mail` source
- **LinkedIn and Glassdoor are never scraped** — their links from an alert are never opened; the description is looked up on the company's ATS board through Brave, and without it there is no card
- **Matching is code:** one rule per file (`modules/matching/helpers/rules`) against the current resume and `profile_preferences` — languages, place, level, Hebrew, years, excluded companies; verdict `fit` / `almost` / `no_fit` with reasons
- **Dedup** by URL and by normalized `company + title` (lowercase, legal suffixes like Ltd/Inc stripped) within one country
- **Queues** (BullMQ, Redis): `search`, `email`, `extract` (`EXTRACT_CONCURRENCY`, `1` for Ollama — it serves one request at a time), `notify` (one message a second). Schedules are Job Schedulers (`upsertJobScheduler`); Bull Board is mounted as a NestJS route
- **MCP servers** (ADR-023) are entry points of the API over a Nest context without queues; `jobs-db` answers the owner's questions in Claude Code / Claude Desktop — six read tools and `record_action`, the same choice a card button stores. Logs go to stderr — stdout is the protocol. `browser`, `gmail`, `notify` come with the agents that need them
- **Telegram cards on events** (ADR-019): a `fit` / `almost` vacancy at once, a closed or changed one the owner saw, a stopped source, a company board from discovery (*Add as a source / Ignore*); buttons *Interested / Skip / Applied* are stored. The owner sends the CV themselves

Details: [docs/project-brief.md](docs/project-brief.md), decisions: [docs/decisions.md](docs/decisions.md).

## Layout

```
apps/api/            NestJS 12: workers, agents, Telegram, /health, Bull Board; MCP entry points in src/mcp
apps/web/            Nuxt UI — optional, later (not created yet)
packages/shared/     shared enums and registries: queue, job and scheduler names, log constants
packages/db/         Drizzle schema, SQL migrations, seeds, client
packages/mcp/        MCP wiring: the stdio server factory, server names, tool answer helpers
docker/              Postgres init, Loki config, Grafana provisioning and dashboard
docker-compose.yml   postgres, redis, loki, grafana
Dockerfile           image of apps/api (release artifact)
.github/             CI, release-please, dependabot
pnpm-workspace.yaml  workspaces + minimumReleaseAge
```

## Always

- New code follows `.claude/rules/`
- Do not write tests unless the user asks for them
- A new env variable goes into `.env.example` and is read through `ConfigService`, never `process.env`. Secrets live only in `.env`, which is never read or committed
- A new dependency respects the 7-day release delay — use ranges (`^12.0.0`), never "the newest" version: [.claude/rules/dependencies.md](.claude/rules/dependencies.md)
- Never add scraping of LinkedIn, Glassdoor or any site whose terms forbid it (ADR-003)
- Never let an LLM decide whether a vacancy fits — that is a filter in code or the human
- Mail access is **read-only**; the project never sends, deletes, moves or flags mail, and never sends the body of an e-mail that is not a job alert to an LLM
- Skills: `pr-ready` (checks before a PR), `docs-sync` (docs after a change); command `/deps-update` (minor updates)
- Commits are Conventional Commits and short: [docs/memory/feedback-short-commit-messages.md](docs/memory/feedback-short-commit-messages.md)

## Where to Look

| Need | Location |
|------|----------|
| Goals, architecture, queues | `docs/project-brief.md` |
| Stack, versions, env vars, host vs Docker | `docs/tech-context.md` |
| Architecture decisions (ADRs) | `docs/decisions.md` |

## Related Documentation

- [`.claude/rules/`](.claude/rules/) — **mandatory** standards. Always loaded: workflow, project-knowledge, code-style, dependencies, observability. Loaded when matching files are read: nestjs-patterns, testing, llm, database, one-entity-per-file, mcp. Rules for agents, queues and browser are added when that code appears
- [project-brief.md](docs/project-brief.md) · [tech-context.md](docs/tech-context.md) · [decisions.md](docs/decisions.md)
- [MEMORY.md](docs/memory/MEMORY.md) — project memory
