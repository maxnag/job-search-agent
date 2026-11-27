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

**Amendment (2026-11-23):** the rules come from the owner's resume, not only from config. The LLM extracts the
resume and every vacancy into the same fields (skills by the shared dictionary, experience, spoken languages); code
compares a vacancy with the current resume of a profile and names the reason of every mismatch. The LLM still never
decides fit.

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

**Amendment (2026-11-23):** most career pages need no agent. A source is fetched by plain code in one of two modes
set by the owner: `html` — one request, the list is in the HTML; `rendered` — headless Playwright opens the page,
waits for the network and scrolls while the number of links grows. Filters written in the source URL cover the usual
search forms. The agent and its recipe stay for sites whose list comes only as the answer to a form (ADR-017).

**Amendment (2026-11-24):** an ATS board is no longer a branch of the agent. A board on Comeet, Greenhouse or Lever is
a source of its own (`ats`), read by code through the system's public API (ADR-021); the agent never detects or
drives it.

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

**Amendment (2026-11-23):** `.env` holds only the provider (`LLM_PROVIDER`, its key or URL, the timeout). The model
and the request parameters of each step live in the `llm_settings` table (provider + step), tuned by hand; the
`LLM_MODEL_*` keys are gone. The parameters are one JSONB under the provider's own names — Anthropic
`{ max_tokens, thinking, effort }` (no temperature), Ollama `{ num_predict, temperature, num_ctx, … }` — checked by
the provider's Zod schema; there is no separate column for any of them. The seed only inserts missing rows, so a
tuned row survives `pnpm db:seed`. It gives both providers a row per step: Haiku 5.5 for Anthropic, one local model
(`qwen3.8:27b-mlx`) for every Ollama step.

---

## ADR-013: Releases by release-please, the image is the artifact

**Status:** Accepted

**Context:** bumping versions in every commit conflicts between branches and on `--amend`.

**Decision:** Conventional Commits (commitlint hook); release-please keeps a release PR with one version for the
monorepo and `CHANGELOG.md`; its merge tags `vX.Y.Z` and builds the `apps/api` image to GHCR after a Trivy scan. The image part is superseded
by ADR-024.

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

---

## ADR-016: A profile is the latest version of a resume

**Status:** Accepted

**Context:** the search starts from the owner's resume; there may be several profiles (developer, cook …), and a
resume changes over time.

**Decision:** `pnpm cv:import <file> --profile <name>` parses the file by its extension (PDF now, other formats are
new parsers), the LLM extracts it into one schema, and the result is a new resume version of the profile. The LLM
only lists names and dates: the skills named in each job and the skills claimed in the summary or skills section.
Years are counted by code from the job periods (a year without a month runs January to December, overlaps count
once); a skill named only in a job's stack is kept with its years but is not claimed; the dictionary's `implies`
adds periods (TypeScript → JavaScript). The latest
imported version is the only source of truth — there are no manual corrections on top: a mistake is fixed in the
resume and imported again. The same file again changes nothing; a file seen before becomes current again. The file
is kept under `STORAGE_DIR`, never in git.

**Consequences:**
- (+) One source of truth, reproducible from a file; matches can point at the resume version they used
- (+) A new resume format is one parser class
- (+) Years are reproducible: the same file gives the same numbers
- (−) Extraction quality depends on the prompt and the model; a job without a stack line adds no years to any skill

**Amendment (2026-11-23):** the scan is reviewed by the owner before any search. Every skill of a version has a
switch `resume_skill_is_hidden`: the owner hides what the resume names but is not theirs (a language only in a
project's stack). A hidden skill takes no part in matching. The switches follow the current version: a new or
restored version gets the hidden set of the version that was current, by skill key. The resume stays the source of
the skills; the switch only decides which of them count.

---

## ADR-017: Career pages are the input, crawled politely

**Status:** Accepted

**Context:** the owner keeps a list of company career pages, often with the filters already in the URL. Sites tolerate
a reader, not a bot that hammers them; ADR-003 already rules out fighting a site that does not want to be read.

**Decision:** a source is a row of `sources` added by hand: a URL and a fetch mode (`html` or `rendered`, ADR-004
amendment). Every request goes through one crawler:
- `robots.txt` of the host is read before any page and obeyed (RFC 9309: the `*` group, longest match, `Allow` wins a
  tie); a host whose `robots.txt` does not answer gets no request at all until it does
- one request at a time per host, a random pause between `CRAWL_DELAY_MIN_MS` and `CRAWL_DELAY_MAX_MS` after each,
  the User-Agent of a regular browser, a timeout on every request
- 403, 429 or a challenge page (Cloudflare, DataDome, PerimeterX) stops the source (`source_status = blocked`), a
  forbidden path stops it as `blocked_by_robots`; the owner is told and switches it back by hand
- no proxy rotation, no captcha solving, no retry against a refusal
- sources are scanned every `SEARCH_INTERVAL_HOURS`, each shifted by a random part of `SEARCH_JITTER_MINUTES`

**Consequences:**
- (+) A site sees a slow, regular visitor; the owner learns at once when a site says no
- (+) One place holds every politeness rule for both fetch modes and for vacancy pages too
- (−) A site behind a challenge stays unread — its vacancies must come from e-mail alerts

**Amendment (2026-11-24):** a listing split into pages is read page after page, by code: the next page is the one
`rel="next"` or a "Next" link names, else a numbered link exactly one page ahead (an offset — any step ahead), else
the number after the current one in a row of page numbers — never a page further ahead, which would skip one. Every
page goes through the same crawler — `robots.txt`, the address guard, the pause — in the mode of the source, at most
`LISTING_MAX_PAGES` pages, and a page already read ends the list. A refusal of a later page is a gap, not a stop:
a path `robots.txt` forbids, a failed or missing page, a refused address leave the pages read written and the
listing incomplete (ADR-019 amendment) — the first page was allowed and read. 403, 429 or a challenge on any page
still stops the source

---

## ADR-018: Screen by title before extraction

**Status:** Accepted

**Context:** most links of a career page are vacancies the owner does not want (sales, QA, another country). Reading
each of their pages with the LLM costs time and money for nothing.

**Decision:** two LLM steps with code between them. `listing`: cheerio reduces the page to numbered links with the
text around each; the LLM returns the links that are single vacancies — by **number**, never by URL — with title,
place, role family and level from the title. Code then screens each position against the preferences of every
profile (`profile_preferences`: role families, lowest level, places by country with work modes and excluded cities,
excluded companies); a position no profile wants is stored as `skipped` with the reason. Only the rest go to
`extract`, which reads the vacancy page into the fields of the profile. A page whose text hash did not change is not
read by the LLM again. `pnpm vacancies:report` shows every position with its stage and reason, so the owner can check
that the screening drops nothing they need.

**Consequences:**
- (+) The LLM reads only pages that may fit; a skipped position keeps a named reason (ADR-002)
- (+) The LLM cannot invent or redirect a URL — it can only pick a link the page has
- (−) A title that hides its role ("Hero #3") is classified by guess; the report is the safeguard

---

## ADR-019: Notifications on events, not a digest

**Status:** Accepted

**Context:** a scheduled digest delays a good vacancy by hours and repeats what the owner has already seen.

**Decision:** a card goes to Telegram as soon as something happens: a vacancy matched as `fit` or `almost` against the
current resume, a vacancy the owner was told about closed or changed, a source stopped. `no_fit` is never sent.
A card is sent once per vacancy and profile — a new resume version inherits the time the card was sent. Cards that
could not go out (no bot configured yet, Telegram down) are picked up every `NOTIFY_SWEEP_MINUTES`. The bot runs by
long polling inside the API — no webhook, no public address — and answers only its own chat; a button press is
stored in `vacancy_actions` with its history.

**Consequences:**
- (+) A good vacancy reaches the owner within one scan
- (+) No duplicates across scans and resume versions
- (−) A busy scan may send several messages in a row; the notify queue sends at most one per second

**Amendment (2026-11-24):** a vacancy gone from its listing is closed only when the scan saw the whole listing. A
scan reports its gaps — pagination left unread (`rel="next"`, a "Next" link in English, Hebrew or Ukrainian, a
numbered page or offset ahead, a row of page numbers or of numbered buttons, a "Load more" button — past
`LISTING_MAX_PAGES`, on a page not read, or with no address to follow, ADR-017 amendment), the `LISTING_MAX_LINKS` cut, a `rendered` page whose links still grew when
the scrolling stopped. A listing with a gap closes nothing: an extracted vacancy not on it is read again on its own page
once it is due (`VACANCY_RECHECK_HOURS`), and the page decides — gone or saying the position is closed. The signs are
found by code, not by the LLM, and are wide on purpose: a false gap only delays a closing, a missed one sends the owner
a false "closed" card. An ATS board answers with the whole list and has no gaps

---

## ADR-020: Text from the web is untrusted

**Status:** Accepted

**Context:** a vacancy page is written by someone else. Its text may try to steer the LLM (prompt injection), and its
links may point the crawler at the owner's machine or network (SSRF).

**Decision:**
- the LLM steps that read web text have **no tools**: one call, the answer constrained by a JSON schema and checked by
  Zod; fit is decided by code (ADR-002). The worst an injection can do is fill a field wrongly, as a lying posting
  would
- the page text goes into the prompt fenced as `<posting>…</posting>`, the links as `<links>…</links>`; any such tag
  inside the text is removed, and each prompt says the fenced text is data, never an instruction
- hidden elements (`hidden`, `aria-hidden="true"`, inline `display:none` / `visibility:hidden`) are replaced with a
  space before the text reaches the LLM
- fields are clipped by code after validation (title 200, company 120, city 80, summary 1000 characters, at most 50
  skills of a kind) — not refused by the schema, so one planted field cannot fail the scan of a whole page
- every request, every redirect hop (`html` follows redirects by hand) and every request of a rendered page is
  refused when its host resolves to a loopback, private, link-local, carrier-grade NAT, multicast or reserved
  address (`PRIVATE_ADDRESS`, not retried); such a vacancy is skipped with the reason
- Telegram cards escape every field and disable link previews

**Consequences:**
- (+) An injection cannot act, leak or decide; it can only mislead one vacancy, which the owner still reviews
- (+) A link on a page cannot reach Bull Board, Redis, Postgres or a cloud metadata endpoint
- (−) Text hidden by a CSS class is not recognized; a host that changes its DNS answer between the check and the
  request (DNS rebinding) and a redirect inside the browser are not caught before the request is made
- (−) Agents with tools (the browser and mail agents) need more: a domain allowlist in the tool code, a step and
  budget limit, and their output treated as data checked by code

---

## ADR-021: ATS boards through their APIs, companies found by web search

**Status:** Accepted

**Context:** many companies, Israeli start-ups most of all, publish their vacancies on an applicant tracking system
(Comeet, Greenhouse, Lever) instead of their own site. Each system has a public job-board API — the positions of one
company, with country and work mode as fields — but none can search across companies. The owner cannot list every
such company by hand.

**Decision:**
- **A board is a source** with `source_fetch_mode = 'ats'`; `source_url` is the canonical link of the board, and the
  system and board are read from it — no new columns in `sources`. One client per system lists the positions and
  reads one posting; its answer is checked by a Zod schema per position, and a board whose answer does not match
  fails with `ATS_RESPONSE_INVALID`
- **The requests go through the crawler** (ADR-017): `robots.txt`, the address guard, one request at a time per host
  and a stop on 403 / 429 apply unchanged. A public API made for programs gets a shorter pause
  (`CRAWL_API_DELAY_MIN_MS` … `CRAWL_API_DELAY_MAX_MS`); Comeet has no API without a company token, so its hosted page
  is read with the pause of a site and the positions come from the JSON the page embeds
- **The `listing` step stays** but reads only titles: role and level come from the LLM, country, city and work mode
  from the system where it gives them. Positions in a country no profile searches are dropped by code before the LLM.
  An extracted vacancy keeps the position id of the system (`vacancy_external_id`); its text comes from the posting
  API, and a posting that is gone closes the vacancy
- **The country is part of the dedup key:** one title of one company in two countries is two vacancies
  (`vacancy_dedup_key` + `vacancy_dedup_country`; an unknown country joins the row of any country)
- **Companies are found by code, decided by the owner.** `sources:add <link>` adds any board or career page by hand.
  Discovery builds web search queries from the profiles (`site:<board domain> <country> "<role>"`, at most
  `DISCOVER_MAX_QUERIES`, on `DISCOVER_CRON`), reduces each result URL to a board and keeps nothing else of the
  results. A board not yet known is listed through its API and stored in `source_candidates` with what the system
  answered: company, positions, how many pass the screening by company and place, a few examples. A board with a
  passing position becomes a Telegram card with *Add as a source* / *Ignore*; at most `DISCOVER_MAX_CARDS` cards wait
  for a decision. *Ignore* is final; a board with nothing passing is checked again after `DISCOVER_RECHECK_DAYS`
- **No LLM in discovery,** and no key — no discovery: without `BRAVE_SEARCH_API_KEY` the schedule is removed with one
  warning and the API runs as before

**Consequences:**
- (+) A board is read in one request without page noise; country and work mode are facts, not guesses
- (+) The terms of the web search are kept: its results are never stored or logged — the database holds only what the
  tracking system answered
- (+) A new company reaches the owner as one card, and becomes a source only by the owner's press
- (−) A company the search engine has not indexed, or one on another system (Workday, Ashby …), still needs
  `sources:add` or a career page source
- (−) The candidate count may be large; cards come in batches as the owner decides the open ones


## ADR-022: Job-alert e-mails over IMAP, the kind told from the headers

**Status:** Accepted

**Context:** LinkedIn, Glassdoor and the job boards that may not be crawled reach the owner only as job-alert e-mails,
and many companies send their own alerts. The mailbox is personal: most e-mails are not about work, and a recruiter's
letter is private. The owner reads mail in Gmail today, but may move to another provider.

**Decision:**
- **A port with one adapter per provider:** `IJobMailProvider` opens a mailbox, `IJobMailbox` lists the headers of a
  window and fetches one message; `JOB_MAIL_PROVIDER` picks the adapter. The first one is IMAP with a Gmail app
  password (`JOB_MAIL_IMAP_*`) — no OAuth client and no Google project
- **Read-only is enforced by code:** the folder is opened with `EXAMINE`, a message is fetched with `BODY.PEEK`, and
  the adapter has no command that stores flags, moves, deletes or sends. An e-mail stays unread if it was unread
- **A window, never the history:** each run looks at the last `JOB_MAIL_LOOKBACK_HOURS` (at most
  `JOB_MAIL_MAX_MESSAGES` e-mails), every `JOB_MAIL_INTERVAL_MINUTES` on the `email` queue. Every e-mail looked at is
  a row of `job_mail_messages`, keyed by its `Message-ID` header — the same key whatever the provider — so no e-mail
  is classified or read twice
- **The kind is told by the LLM from the headers only** — sender name, sender domain and subject, fenced as data
  (ADR-020): `job_alert`, `recruiter` or `other`; an e-mail the answer leaves out counts as a job alert. A list of
  senders would miss every new mailing. **Only a job alert has its body fetched;** the body of any other e-mail is never
  read, so a private letter never reaches a cloud LLM
- **A job alert is read like a listing:** its links are unwrapped from redirects, cleaned of tracking and service
  links; the `listing` step picks the vacancies by number and code screens them by the profiles (ADR-018). An alert is
  never the whole list, so it **closes nothing**. The sender domain becomes a source (`source_fetch_mode = 'job_mail'`,
  `mailto:@<domain>`) that the scanner never fetches; switching it off ignores its next alerts
- **LinkedIn and Glassdoor links are never opened** (ADR-003): a link rule per site keeps the canonical vacancy link
  and marks it not to be fetched. Its description is looked up on the company's ATS board (Comeet, Greenhouse, Lever)
  by a Brave query `site:<board> "<company>"`; the same title of the same company in the same country is that vacancy,
  and its posting is read through the board API (`vacancy_text_url`). Not found — the vacancy stays `listed` without a
  card, and the search is repeated after `JOB_MAIL_TEXT_RECHECK_DAYS`, at most `JOB_MAIL_TEXT_MAX_SEARCHES` times
- **A refused password stops the reading:** the schedule is removed until the API restarts and one Telegram notice
  says so; a lost connection is retried like any transient failure

**Consequences:**
- (+) Any mailing works without configuration, and the owner's private mail stays out of the cloud
- (+) Another provider is one adapter; the rest of the pipeline is the one of the career pages
- (+) A LinkedIn vacancy becomes a full card only from the company's own posting — nothing is scraped
- (−) A vacancy of a company without a public ATS board, seen only on LinkedIn, never gets a card
- (−) An app password grants the whole mailbox to whoever holds it; it lives only in `.env` on the owner's machine

## ADR-023: MCP servers are entry points of the API; reads plus one write

**Status:** Accepted

**Context:** the owner wants to ask about their own search in plain words — "where did I apply this week", "why is this
vacancy no_fit" — from Claude Code or Claude Desktop, and the future agents need tools. The answers already live in
the database behind the API's repositories; the report command (`vacancies:report`) has the same filter. A package
cannot import the application, so servers inside `packages/mcp` would duplicate every query.

**Decision:**
- **An MCP server is an entry point of `apps/api`** (`apps/api/src/mcp/<name>.server.ts`): a Nest application context
  of `MCPModule` — config, logger, database and the tools module — without HTTP, queues or Redis. `packages/mcp` keeps
  only the wiring: `startStdioServer` (stdio transport, close on the end of stdin or a stop signal) and the answer
  helpers `toolResult` / `toolError`
- **A server ships with the agent that needs it:** `jobs-db` now; `browser` with the browser agent, `gmail` and
  `notify` with the reading of recruiters' replies. No empty server is kept
- **`jobs-db` reads, and writes one thing:** six read tools (`find_vacancies`, `get_vacancy`, `list_applications`,
  `pipeline_summary`, `list_sources`, `list_source_candidates`) and `record_action` — the owner's choice
  (`applied` / `interested` / `skipped`) stored exactly as a card button stores it, without a Telegram message
  (`vacancy_action_message_id` is nullable). A repeat of the latest choice about a vacancy, from any channel, is not
  stored again. Nothing else can be changed or deleted through MCP
- **A tool is one class** with its private input and output Zod schemas; the SDK validates the input and checks the
  output. The answer is `structuredContent` plus a one-line summary and the same JSON as text. A list is capped at
  `MCP_MAX_ROWS` whatever the client asks, with the total
- **Errors carry a code, never a cause:** a refusal the client can act on (`VACANCY_NOT_FOUND`) is answered with its
  code; any other failure is logged to stderr with its cause and answered `TOOL_FAILED`. The SDK would put an
  exception's text into the answer, so every call goes through one runner that catches it
- **stdout belongs to the protocol:** the logger of a server writes to stderr (and Loki), Nest starts with only
  `error` / `fatal`, a build before the start writes to stderr too
- **Web text stays data** (ADR-020): every tool that returns titles, companies or extracted fields says so in its
  description; the client model must not follow instructions found in them. Nothing from the mailbox but what is
  already a vacancy, and no secret or `llm_settings` row, is ever returned
- **The same database role** as the API; the write is limited by code

**Consequences:**
- (+) One filter for the command and the tool; the queries are the API's own, covered by its e2e tests
- (+) The owner's questions need no SQL and no new UI; a choice made in a conversation counts like a button
- (−) A server starts a Nest context (about a second) and needs the built API (`pnpm api:build`)
- (−) The client sees everything the tools return — the vacancies, verdicts and profile names go to the cloud model

---

## ADR-024: No image — the project runs only on the owner's machine

**Status:** Accepted (supersedes the image part of ADR-013)

**Context:** the API, the MCP servers, Playwright and Ollama run on the host of the owner's Mac; Docker holds only
Postgres, Redis, Loki and Grafana. There is no production and no deploy. The `apps/api` image was built on every
release and on every PR that touched the dependencies, scanned by Trivy and pushed to GHCR — and never run.

**Decision:** no `Dockerfile`; CI checks the code only, a release is the version bump, `CHANGELOG.md` and the tag.
Dependencies stay checked by `pnpm audit` in CI; the one-week delay still applies to the images of
`docker-compose.yml`.

**Consequences:**
- (+) Shorter CI and release runs; no image to keep secure that nobody uses
- (−) `APP_VERSION` is no longer set by a build — `/health` and the logs say `dev` unless it is set by hand
- (−) A deploy, if it ever comes, starts with a new image and a new ADR

---

## ADR-025: Web UI — Next.js as the only door to the API, on localhost

**Status:** Accepted

**Context:** the owner wants to see the vacancies, companies and sources, filter the vacancies, open a description by
its link and make the same choice a card button makes — from a browser, later from a phone or a tablet over
Tailscale. Telegram shows one vacancy at a time; `vacancies:report` and the MCP server answer questions but show no
list to work through. There is no production: the UI lives on the owner's machine, next to the API.

**Decision:**
- **`apps/web` is a Next.js app (App Router, React)**, chosen over Nuxt so the owner learns React
- **The browser talks only to Next:** server components and server actions call the NestJS API through one
  server-only client (`fetch`, a timeout, Zod on every answer); the address of the API never reaches the browser,
  and the API keeps no CORS
- **Mantine** is the UI kit — a full set of components with a light and a dark scheme; icons from Tabler
- **The language is the first segment of the address** (`/en/…`, `/uk/…`, next-intl); without one, the browser's
  language or the cookie of the last choice decides. English and Ukrainian, a switcher in the header
- **Filters live in the query string**, so a list can be shared or bookmarked as a link
- **Localhost only:** the API and the web listen on `127.0.0.1` (`APP_HOST`, `WEB_HOST`); no token, no login, no
  image. Remote access is `tailscale serve` on the Mac, never a public port. Requests to the API by hand go through
  a Postman workspace kept by the Postman MCP server, not an OpenAPI document

**Consequences:**
- (+) One place reads the API; the browser holds no secret and no address
- (+) The vacancy list, its filters and the actions share the API's queries with the MCP server and the commands
- (−) A second app to run (`pnpm web:dev`) and a React toolchain next to the Nest one
- (−) Next renders on every request — the API must be running for any page with data
