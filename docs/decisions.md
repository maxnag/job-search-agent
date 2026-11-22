# Architecture Decision Records (ADR)

Format: **Status**, **Context**, **Decision**, **Consequences** (+/−). A decision changed later gets an
amendment or a new ADR that supersedes it — never a silent edit.

---

## ADR-001: Hybrid — agents only where the path varies

**Status:** Accepted

**Context:** navigating an unknown career page or reading a free-form e-mail differs every time; fetching,
dedup, filtering and notifying do not.

**Decision:** LLM agents only for site navigation and e-mail triage; everything else is ordinary code.

**Consequences:**
- (+) Predictable, cheap, testable core
- (+) Fewer LLM calls — matters with a single local Ollama
- (−) Two styles of code to maintain

---

## ADR-002: The LLM never judges a vacancy

**Status:** Accepted

**Context:** a model's "fit score" is unreproducible and hides why a vacancy was dropped.

**Decision:** the LLM only extracts structured data. Fit is decided by filters in code (rules in config) and,
finally, by the human through the digest buttons.

**Consequences:**
- (+) Every dropped vacancy has a named rule
- (+) Button presses become data to tune the rules
- (−) Rules must be written and kept up to date by hand

---

## ADR-003: No scraping of LinkedIn and Glassdoor

**Status:** Accepted

**Context:** both forbid scraping in their terms and ban accounts for it.

**Decision:** their vacancies come only from Job Alert e-mails; data is taken from the e-mail itself.

**Consequences:**
- (+) No account risk
- (−) Less detail per vacancy than the page would give

---

## ADR-004: Browser recipes — the LLM navigates a site once

**Status:** Accepted

**Context:** driving Playwright with an LLM on every run is slow and non-deterministic.

**Decision:** the agent navigates once and saves a recipe (actions or a final URL); later runs replay it
without an LLM. The agent is re-engaged only when the recipe breaks. ATS boards use their public APIs.

**Consequences:**
- (+) Daily runs are fast and free
- (−) A recipe can break silently when a site changes — it must be detected and reported

---

## ADR-005: Redis for BullMQ, Ollama on the host

**Status:** Accepted

**Context:** BullMQ 6 offers a Postgres backend, but it is new. Docker on macOS has no Metal access.

**Decision:** BullMQ on Redis 8.10 in Docker; Ollama runs natively on the Mac.

**Consequences:**
- (+) Proven queue backend; GPU-accelerated local LLM
- (−) One more container; Ollama is outside `docker compose`

---

## ADR-006: pnpm workspaces with a 7-day release delay

**Status:** Accepted

**Context:** supply-chain attacks usually ship in fresh releases and are pulled within days.

**Decision:** pnpm monorepo with `minimumReleaseAge: 10080`; the same one-week rule for Docker image tags.

**Consequences:**
- (+) Freshly compromised versions never install
- (−) Fixes arrive a week later; urgent ones need `minimumReleaseAgeExclude`

---

## ADR-007: ESM across the monorepo

**Status:** Accepted

**Context:** the NestJS 12 core, the MCP SDK and the Ollama client are ESM-first.

**Decision:** `"type": "module"` everywhere, `module` / `moduleResolution: nodenext`; relative imports carry `.js`.

**Consequences:**
- (+) No dual-package hazards, top-level `await` in entry points
- (−) Every relative import needs an extension; CommonJS-only tools need care

---

## ADR-008: Drizzle ORM

**Status:** Accepted

**Context:** the schema needs JSONB with types and pgvector (`vector`, HNSW, `cosineDistance`) for a possible RAG;
raw SQL must stay first-class.

**Decision:** `drizzle-orm` with the `pg` driver and `drizzle-kit` for SQL migrations; no generated client.

**Consequences:**
- (+) Typed queries, plain SQL migrations under review, raw SQL through the `sql` template
- (−) No `down` migrations (see ADR-014); triggers and extensions are hand-written custom migrations

---

## ADR-009: Vitest with SWC, `tsc` for the build

**Status:** Accepted

**Context:** Jest needs extra work for ESM; esbuild emits no decorator metadata, which Nest DI needs.

**Decision:** Vitest with `unplugin-swc` for tests only; `tsc -b` with project references builds and type-checks.

**Consequences:**
- (+) One compiler for the build, which checks types as it builds; ESM tests out of the box
- (−) Tests compile with SWC, which checks no types — `pnpm typecheck` covers the specs

---

## ADR-010: Zod 4 for every schema

**Status:** Accepted

**Context:** env, DTOs and LLM answers all need runtime validation and a TypeScript type.

**Decision:** Zod 4 — one schema gives the type, the validation, the JSON Schema sent to the LLM
(`z.toJSONSchema`, the Anthropic `zodOutputFormat`) and the env validation of `@nestjs/config` (Standard Schema).

**Consequences:**
- (+) No drift between a type and its validation
- (−) Provider JSON Schema support is a subset — a schema may need adjusting per provider

---

## ADR-011: grammY for Telegram

**Status:** Accepted

**Context:** the digest needs inline buttons and callback queries, typed.

**Decision:** grammY.

**Consequences:**
- (+) TypeScript-first, maintained, small
- (−) Its own middleware model next to Nest's

---

## ADR-012: The LLM provider is a setting

**Status:** Accepted

**Context:** development runs on Linux without Ollama; production is the Mac with Ollama. Code must not care.

**Decision:** a port (`LLMClient`) with Anthropic and Ollama adapters, chosen by `LLM_PROVIDER`; a model per step
(`LLM_MODEL_MAIL`, `LLM_MODEL_EXTRACT`, `LLM_MODEL_NAVIGATION`). Supersedes the "Haiku only as a fallback" note.

**Consequences:**
- (+) Moving to the Mac changes `.env`, not code; a step can use a stronger model alone
- (−) Two adapters to keep in step; structured-output features differ between providers

---

## ADR-013: Releases by release-please, the image is the artifact

**Status:** Accepted

**Context:** bumping versions in every commit conflicts between branches and on `--amend`.

**Decision:** Conventional Commits (commitlint hook); release-please keeps a release PR with one version for the
monorepo and `CHANGELOG.md`; its merge tags `vX.Y.Z` and builds the `apps/api` image to GHCR after a Trivy scan.

**Consequences:**
- (+) A version is bumped once, in the release PR; history drives the changelog
- (−) PR titles must be conventional — the squash merge uses them

---

## ADR-014: Migrations go forward only

**Status:** Accepted

**Context:** `drizzle-kit` has no `down`; a hand-written rollback is rarely tested.

**Decision:** an applied migration never changes; a mistake is fixed by a new migration; `pg_dump` before a risky
one. Migrations run only by an explicit command, never on application start.

**Consequences:**
- (+) One linear, reviewed history; no untested rollback code
- (−) Undoing a change takes a new migration

---

## ADR-015: Logs to Loki over OTLP, viewed in Grafana

**Status:** Accepted

**Context:** queue jobs and agents run unattended; their logs must be searchable after the fact.

**Decision:** pino (`nestjs-pino`) writes JSON; with `OTEL_EXPORTER_OTLP_ENDPOINT` set it also pushes to a local
Loki over OTLP. Loki labels are only resource attributes; every other field is structured metadata. Grafana with a
provisioned dashboard runs next to Loki in Docker.

**Consequences:**
- (+) Search by any field (request id, vacancy id) without a label explosion; the same code ships to Grafana Cloud
- (−) Two more containers; Loki and Grafana are unauthenticated and must stay on `127.0.0.1`
