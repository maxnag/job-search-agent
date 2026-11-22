# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Last synced commit:** `e5f826c` (initial commit)
> Run `git log e5f826c..HEAD --stat` to see what changed since this doc was last updated.
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

Job Search Agent collects vacancies from career pages and from job-alert e-mails, extracts them into structured JSON with a local LLM, filters them with plain code and sends a Telegram digest. **The human decides whether a vacancy fits — the agent never does.** It is both a real job-search tool and a portfolio project (AI agents, MCP, queues).

**Target market:** Israel (priority — whole country, full-time / hybrid) and Ukraine (remote). Working language English; vacancies requiring Hebrew are filtered out.

**Tech Stack:** Node.js 24 LTS, NestJS 12, TypeScript, pnpm workspaces monorepo, BullMQ 6 + Redis 8.10, PostgreSQL 18 + pgvector (JSONB), Ollama (Qwen3 9B / 27B), Playwright + cheerio, Gmail API (read-only), Telegram bot, MCP servers over stdio. Claude Haiku 5.5 only as a fallback for site navigation.

**Runs on:** the owner's Mac (Apple Silicon). NestJS, MCP servers, Playwright and Ollama run on the host; only Postgres and Redis run in Docker.

**Phases, progress and open questions** live in the master plan in `.claude/plans/` — never in this file or in `docs/`.

## Commands

> The scripts appear together with the monorepo. Update this block when they change.

```bash
docker compose up -d                   # postgres + redis
pnpm install                           # respects minimumReleaseAge (7 days)
pnpm --filter api start:dev            # NestJS app: workers, agents, Telegram
pnpm typecheck                         # tsc --noEmit across the workspace
pnpm lint:fix && pnpm prettier:fix
pnpm test                              # unit tests
npx playwright install chromium        # once per machine
ollama pull qwen3:9b && ollama pull qwen3:27b
```

## Architecture

```
career pages ─► search queue ─► (browser agent once per site → recipe) ─► links ─┐
Gmail alerts ─► email queue  ─► (mail agent: classify, pick action)    ─► links ─┤
                                                                                 ▼
                       extract queue (Qwen 27B → JSON) ─► dedup ─► filters (code) ─► notify queue ─► Telegram digest ─► human
```

- **Hybrid design:** an agent only where the path differs every time (navigating a site, reading an e-mail); everything else is ordinary code. The LLM understands text and extracts data — it **never scores or judges a vacancy**
- **Both channels converge** into one extraction step and one set of filters
- **Browser agent** drives Playwright once per site and saves a **recipe** (action sequence or final URL with params); later runs replay the recipe without an LLM. The agent is re-engaged only when a recipe breaks. ATS-hosted boards (Comeet, Greenhouse, Lever) go through their public APIs
- **LinkedIn and Glassdoor are never scraped** — only their Job Alert e-mails are read, and the data comes from the e-mail itself
- **Filters are code, rules are config:** stack, location, no mandatory Hebrew, level, exclusion list
- **Dedup** by URL and by normalized `company + title` (lowercase, legal suffixes like Ltd/Inc stripped)
- **Queues** (BullMQ, Redis): `search`, `email`, `extract` (`concurrency: 1` — Ollama serves one request at a time), `notify`. Schedules are Job Schedulers (`upsertJobScheduler`); Bull Board is mounted as a NestJS route
- **MCP servers** `browser`, `gmail`, `jobs-db`, `notify` are the agents' tools, and the same servers plug into Claude Desktop so the owner can ask about their applications in plain words
- **Telegram digest** has buttons *Interested / Skip / Applied*; presses are stored and used to tune filters. The owner sends the CV themselves

Details: [docs/project-brief.md](docs/project-brief.md), decisions: [docs/decisions.md](docs/decisions.md).

## Planned layout

```
apps/api/            NestJS 12: workers, agents, Telegram
apps/web/            Nuxt UI — optional, later
packages/shared/     types and schemas (vacancy JSON, statuses)
packages/db/         Postgres schema, migrations, client
packages/mcp/        MCP servers: jobs-db, browser, gmail, notify
docker-compose.yml   postgres + redis
pnpm-workspace.yaml  workspaces + minimumReleaseAge
```

## Always

- New code follows `.claude/rules/`
- Do not write tests unless the user asks for them
- A new env variable goes into `.env.example` and is read through `ConfigService`, never `process.env`. Secrets live only in `.env`, which is never read or committed
- A new dependency respects the 7-day release delay — use ranges (`^12.0.0`), never "the newest" version: [.claude/rules/dependencies.md](.claude/rules/dependencies.md)
- Never add scraping of LinkedIn, Glassdoor or any site whose terms forbid it (ADR-003)
- Never let an LLM decide whether a vacancy fits — that is a filter in code or the human
- Gmail access is **read-only**; the project never sends, deletes or labels mail
- Skills: `pr-ready` (checks before a PR), `docs-sync` (docs after a change); command `/deps-update` (minor updates)
- Commits are short: [docs/memory/feedback-short-commit-messages.md](docs/memory/feedback-short-commit-messages.md)

## Where to Look

| Need | Location |
|------|----------|
| Goals, architecture, queues | `docs/project-brief.md` |
| Stack, versions, env vars, host vs Docker | `docs/tech-context.md` |
| Architecture decisions (ADRs) | `docs/decisions.md` |

## Related Documentation

- [`.claude/rules/`](.claude/rules/) — **mandatory** standards. Always loaded: workflow, project-knowledge, code-style, dependencies, observability. Loaded when matching files are read: nestjs-patterns, testing. Rules for agents, queues, browser and MCP are added when that code appears
- [project-brief.md](docs/project-brief.md) · [tech-context.md](docs/tech-context.md) · [decisions.md](docs/decisions.md)
- [MEMORY.md](docs/memory/MEMORY.md) — project memory
