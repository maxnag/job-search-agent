# Tech Context

Versions installed on 2026-11-22 under pnpm's one-week release delay (`minimumReleaseAge`): `package.json` holds
ranges, the lockfile holds the versions below. Peer compatibility was checked by an actual install.

| What | Choice | Installed | Where |
|---|---|---|---|
| Runtime | Node.js | 24 LTS (`.nvmrc`), image `node:24.22.3-bookworm-slim` | host |
| Package manager | pnpm workspaces | 12.18 | host |
| Language | TypeScript, ESM (`module: nodenext`) | 6.0.3 — 7.x is not supported by `typescript-eslint` yet | host |
| Backend | NestJS (`core`, `common`, `platform-express`, `config`) | 12.5.0, config 12.1.1 | host |
| Queues | `@nestjs/bullmq` + `bullmq` | 12.0.2 + 6.7.6 | host |
| Queue UI | Bull Board (`api`, `express`, `nestjs`) | 9.13.1 | host |
| Redis client | `ioredis` (installed explicitly) | 6.0.0 | host |
| ORM | Drizzle (`drizzle-orm` + `pg`, `drizzle-kit`) | 0.45.4, pg 8.23.1, kit 0.31.11 | host |
| Schemas | Zod | 4.6.7 | host |
| Resume parsing | `unpdf` (PDF text layer) | 2.2.1 | host |
| LLM | Anthropic SDK / Ollama client | 1.8.0 / 0.6.4 | API / host (Mac) |
| Browser | Playwright (Chromium), cheerio | 1.65.1, 1.2.0 | host |
| Mail | `googleapis` (Gmail, read-only) | 190.0.0 | API |
| Telegram | grammY | 1.46.0 | API |
| Command output | `cli-table3` (tables), `util.styleText` of Node (colours) | 0.6.5 | host |
| Agent tools | `@modelcontextprotocol/sdk`, stdio | 1.32.2 | host |
| Logs | `nestjs-pino`, `pino`, `pino-opentelemetry-transport` | 5.3.1, 10.4.0, 4.0.2 | host |
| Tests | Vitest + `unplugin-swc` (`@swc/core`) | 5.1.0, 2.0.0 (1.16.22) | host |
| Lint / format | ESLint, `typescript-eslint`, Prettier | 10.15.0, 8.72.2, 3.10.1 | host |
| Database | PostgreSQL + pgvector | `pgvector/pgvector:0.8.7-pg18` | Docker |
| Redis | official image, AOF on | `redis:8.10.3` | Docker |
| Log store / UI | Loki / Grafana | `grafana/loki:3.7.10` / `grafana/grafana:13.3.1` | Docker |

## Notes

- **LLM provider is a setting:** `LLM_PROVIDER=anthropic` (Claude Haiku 5.5, `claude-haiku-5-5`) while development
  runs on Linux without Ollama; `LLM_PROVIDER=ollama` with Qwen3 9B / 27B on the Mac. Model, `max_tokens` and
  provider parameters of each step are rows of the `llm_settings` table (ADR-012 amendment)
- **LLM budget:** local is $0; Haiku 5.5 costs $0.10 / $0.50 per 1M input / output tokens
- **NestJS 12:** the core is ESM; `@nestjs/config` validates env with a Standard Schema (Zod) asynchronously
- **BullMQ 6:** legacy repeatable jobs are gone — schedules via `upsertJobScheduler`; worker connections use
  `maxRetriesPerRequest: null`. BullMQ 6 has a Postgres backend, but it is new — Redis stays
- **Build:** `tsc -b` over project references (`tsconfig.build.json` per package); no Nest CLI. Vitest uses SWC only
  because esbuild emits no decorator metadata, which Nest DI needs
- **Build scripts:** pnpm runs install scripts only for the packages listed in `allowBuilds` (`pnpm-workspace.yaml`)
- **Removed from scope:** RAG, embeddings, Qdrant, MySQL, `@nestjs/schedule`. RAG may return later for cover letters
  (pgvector + OpenAI `text-embedding-3-large`, `dimensions` 1536)

## Host vs Docker

| On the host (Mac; Linux for now) | In Docker (`docker compose up -d`) |
|---|---|
| NestJS, MCP servers, Playwright (`npx playwright install chromium`; on a Linux Playwright has no build for — the system Chrome through `RENDER_BROWSER_CHANNEL=chrome`), Ollama (Mac) | PostgreSQL + pgvector, Redis, Loki, Grafana |

Ollama runs on the host because Docker on macOS has no access to Metal; NestJS reaches it at `OLLAMA_URL`.
Every container port is bound to `127.0.0.1` only; Loki and Grafana run without authentication for that reason.
The image of `apps/api` (`Dockerfile`) is the release artifact; Chromium is installed in it by the `playwright` of
the lockfile. Postgres creates the `job_agent_test` database on the first start of an empty volume
(`docker/postgres/init`); an existing volume needs `CREATE DATABASE job_agent_test` by hand.

## Environment variables

Secrets live in `.env` (gitignored); every key is listed in `.env.example`. The API validates them on start
(`apps/api/src/config/env.schema.ts`) and does not start without a required key, naming it.

| Key | Purpose |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production`; in production `/health` shows only `status` and `version` |
| `APP_PORT` | HTTP port of the API |
| `APP_VERSION` | version reported by `/health`; set by the image build, `dev` otherwise |
| `TZ` | time zone of the app process and of every container (`Asia/Jerusalem` / `Europe/Kyiv`); Postgres also gets it as `timezone`, so dates in the database show in local time |
| `LOG_LEVEL` | `trace` … `fatal`, default `info` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint of Loki (`http://localhost:3100/otlp`; its port follows `LOKI_PORT`); empty — stdout only |
| `LOKI_PORT`, `GRAFANA_PORT` | host ports of Loki and Grafana |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Postgres container |
| `DATABASE_URL`, `DATABASE_URL_TEST` | dev and test databases |
| `DATABASE_CONNECTION_TIMEOUT_MS` | wait for a pooled connection |
| `REDIS_HOST`, `REDIS_PORT` | Redis of BullMQ and the app |
| `BULL_BOARD_PATH` | route of Bull Board |
| `LLM_PROVIDER` | `anthropic` \| `ollama` |
| `LLM_TIMEOUT_MS` | timeout of one LLM request |
| `ANTHROPIC_API_KEY` | required when `LLM_PROVIDER=anthropic` |
| `OLLAMA_URL` | required when `LLM_PROVIDER=ollama` |
| `EXTRACT_CONCURRENCY` | `1` for Ollama, more for the cloud |
| `HEALTH_CHECK_TIMEOUT_MS` | limit of each `/health` check |
| `STORAGE_DIR` | resume files (`profiles/<profile_id>/resumes/<sha256>.<ext>`), relative to the command's working directory |
| `JOB_ATTEMPTS`, `JOB_BACKOFF_MS` | attempts of a failed job and the first pause of its exponential backoff |
| `HTTP_USER_AGENT`, `HTTP_TIMEOUT_MS` | User-Agent of a regular browser for every crawler request; timeout of an `html` request |
| `CRAWL_DELAY_MIN_MS`, `CRAWL_DELAY_MAX_MS` | random pause after each request to a site; the minimum must not exceed the maximum |
| `CRAWL_API_DELAY_MIN_MS`, `CRAWL_API_DELAY_MAX_MS` | the shorter pause before a request to a public job-board API (Greenhouse, Lever); the minimum must not exceed the maximum |
| `ROBOTS_CACHE_TTL_MS` | how long a site's `robots.txt` is trusted before it is read again |
| `RENDER_BROWSER_CHANNEL` | empty — Playwright's own browser; `chrome` \| `chrome-beta` \| `msedge` — one installed in the system |
| `RENDER_MAX_SCROLLS`, `RENDER_TIMEOUT_MS`, `RENDER_SCROLL_WAIT_MS` | limits of a `rendered` page: scrolls, whole page, wait for new links after a scroll |
| `SEARCH_INTERVAL_HOURS`, `SEARCH_JITTER_MINUTES` | how often sources are scanned and the random shift of each |
| `LISTING_MAX_LINKS` | most links of a listing page sent to the LLM |
| `VACANCY_RECHECK_HOURS` | an extracted vacancy still listed is read again at most this often |
| `VACANCY_TEXT_MAX_CHARS` | most characters of a vacancy page sent to the LLM |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | the owner's bot (`<bot id>:<secret>` from @BotFather) and the chat of the cards; both or neither — without them nothing is sent |
| `NOTIFY_SWEEP_MINUTES` | how often cards not sent yet are picked up |
| `BRAVE_SEARCH_API_KEY` | key of the Brave Search API for the discovery; empty — no discovery, the API runs without it |
| `DISCOVER_MAX_QUERIES`, `DISCOVER_CRON` | most web search queries of one discovery run; its schedule (cron, server time) |
| `DISCOVER_RECHECK_DAYS` | a board with no fitting position is checked again after this many days |
| `DISCOVER_BOARD_TIMEOUT_MS` | limit of reading one board during the discovery |
| `DISCOVER_MAX_CARDS` | most board cards waiting for the owner's decision at once |
