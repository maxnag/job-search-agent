# Tech Context

Versions as of 2026-11-22, chosen with pnpm's one-week release delay in mind; peer compatibility is checked by
an actual install.

| What | Choice | Version | Where |
|---|---|---|---|
| Runtime | Node.js | 24 LTS | Mac |
| Backend | NestJS (`@nestjs/core`, `common`, `config`) | 12.5 (then 12.6) | Mac |
| Queues | `@nestjs/bullmq` + `bullmq` | 12.0.2 + 6.7.6 | Mac |
| Redis client | `ioredis` (installed explicitly) | 6.0.0, fallback ^5.4 | Mac |
| Redis | official image | 8.10 | Docker |
| Database | PostgreSQL + pgvector (JSONB, arrays) | 18 (19 later) | Docker |
| LLM | Ollama: Qwen3 9B (mail), 27B (extraction, navigation) | — | Mac, not Docker |
| Cloud LLM | Claude Haiku 5.5 — only when Qwen fails on forms | — | API |
| Browser | Playwright (Chromium), cheerio for simple pages | latest | Mac |
| Mail | Gmail API, read-only | — | API |
| Notifications | Telegram bot | — | API |
| Agent tools | MCP servers over stdio | — | Mac |

## Notes

- **LLM budget:** local is $0; Haiku for navigating sites with recipes costs cents a month
- **NestJS 12:** the core is ESM; CommonJS apps still work
- **BullMQ 6:** legacy repeatable jobs are gone — schedules via `upsertJobScheduler`; worker ioredis connections use `maxRetriesPerRequest: null`. BullMQ 6 has a Postgres backend, but it is new — Redis stays
- **Removed from scope:** RAG, embeddings, Qdrant, MySQL, `@nestjs/schedule`. RAG may return later for cover letters (pgvector + OpenAI `text-embedding-3-large`, `dimensions` 1536)

## Host vs Docker

| On the Mac | In Docker |
|---|---|
| NestJS, MCP servers, Playwright (`npx playwright install chromium`), Ollama | PostgreSQL + pgvector (`pgvector/pgvector:pg18`), Redis 8.10 |

Ollama runs on the host because Docker on macOS has no access to Metal; NestJS reaches it at
`localhost:11434`. Containers have volumes for data and `restart: unless-stopped`.

## Environment variables

Secrets live in `.env` (gitignored); every key is listed in `.env.example`. The table grows with the code.

| Key | Purpose |
|---|---|
| — | — |
