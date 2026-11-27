# Project Brief

## Goal

The agent collects vacancies from websites and from e-mail subscriptions, structures them and sends
Telegram cards. **The decision "fits / does not fit" belongs to the human, not to the agent.**

- **Why:** real help with the job search, and a portfolio project (AI agents, MCP, queues)
- **Geography:** Israel (priority — whole country, full-time / hybrid) and Ukraine (remote)
- **Languages:** English (working), Ukrainian, Russian. Hebrew is weak, so vacancies with mandatory Hebrew are filtered out
- **Timeline:** 3–4 days to build, about a month of job search
- **Runs on:** the owner's Mac (Apple Silicon, 64 GB)

## Inputs

1. **The resume** — `pnpm cv:import <file> --profile <name>`. The LLM extracts skills (with a kind and years),
   experience and spoken languages; the latest version of a profile's resume is the source of truth for matching
2. **Vacancies** — from career pages and ATS boards (rows of `sources`: added with `pnpm sources:add`, or proposed by
   the discovery and added by the owner's press; filters may sit in the URL) and from job-alert e-mails, extracted into
   the same fields and compared with the profile by code

## Architecture

Hybrid: agents where the path differs every time (site navigation, reading an e-mail), ordinary code
everywhere else. The LLM does not evaluate vacancies — it only understands text and extracts data.

Both channels converge into one extraction and one set of filters. Agent tools are MCP servers, and the same
servers plug into Claude Code and Claude Desktop to ask about the owner's applications in plain words. The first one,
`jobs-db`, reads the vacancies, verdicts, choices and sources and records a choice like a card button (ADR-023);
`browser`, `gmail` and `notify` come with the agents that need them.

**LinkedIn and Glassdoor are not scraped:** it violates their terms and risks the account. Their vacancies
arrive only through Job Alert e-mails; their links are never opened — the description comes from the company's own
ATS board, found by web search (ADR-022).

### Career pages

A source is fetched by code in the mode the owner set: `html` (one request a page) or `rendered` (headless Playwright,
scrolled while new links appear). The crawler is polite (ADR-017): `robots.txt` first, one request at a time per site
with a random pause, a regular browser User-Agent; 403, 429 or a captcha stops the source and the owner is told.

1. **Listing:** cheerio reduces the page to numbered links with the text around them; the LLM (`listing` step) picks the
   vacancies by number and reads title, place, role family and level from the title
2. **Screening by code** against the preferences of every profile: role family, lowest level, country, work mode,
   excluded cities and companies. A position nobody wants is kept as `skipped` with the reason (ADR-018)
3. **Extraction** of the rest, then matching and a Telegram card on each event (ADR-019)

A numbered list is followed page after page by code, up to `LISTING_MAX_PAGES`; a refusal of a later page leaves a
gap instead of stopping the source (ADR-017 amendment). A vacancy gone from the listing is closed only when the scan
saw the whole list. Pagination left unread, the link limit or a scroll stopped early make it incomplete: nothing is closed, and an extracted vacancy not seen is read again on its own
page, which decides (ADR-019 amendment). `sources:scan` names the pages read and the gaps.

`pnpm sources:scan` scans by hand, `pnpm vacancies:report` shows every position with its stage and reason —
filtered by source, stage, verdict, reason, place and age, or as a summary per source (`--help` lists the options).

### ATS boards and discovery

A board on Comeet, Greenhouse or Lever is a source of mode `ats` (ADR-021). Its positions come from the system's
public API in one request, through the same polite crawler with a shorter pause for an API. The `listing` step reads
only the titles; country, city and work mode come from the system, and a position in a country no profile searches
is dropped before the LLM. The text of a vacancy comes from the posting API; a posting that is gone closes it.

Discovery finds new boards: code builds web search queries from the profiles (Brave Search API,
`site:<board domain> <country> "<role>"`), keeps only the board each result URL leads to, lists the new boards
through their APIs and stores what the systems answered in `source_candidates`. A board with fitting positions
becomes a Telegram card — *Add as a source* or *Ignore*; the owner decides. Search results are never stored.
`pnpm sources:discover [--dry-run]` runs it by hand; it also runs weekly on `DISCOVER_CRON`.

### Browser agent for search forms

For sites whose list comes only as the answer to a form. The LLM drives Playwright once per site; afterwards code
replays the saved **recipe** without an LLM.

1. **Open** the career page in headless Chromium
2. **Detect the type:** a vacancy list → step 4; a search form (location, department, keywords) → step 3.
   An ATS board is not the agent's work — it is an `ats` source (ADR-021)
3. **Fill the filters:** the agent gets a simplified page snapshot (labelled elements) and calls `select`,
   `click`, `type`, `scroll`. Values come from config (locations `Israel, Tel Aviv, Remote`, departments
   `R&D, Engineering, Development`); the agent picks the closest options
4. **Collect links:** paginate and press "Load more" until vacancies run out
5. **Each link → the `extract` queue.** No agent there: code opens the page, Qwen returns JSON
6. **Save the recipe** to the database: the action sequence or the final URL with parameters. The agent is
   re-engaged only when the recipe stops working

**Guardrails:** at most 15 steps per site, timeouts, a pause of several seconds between requests, runs 1–2
times a day. On failure a screenshot and a page snapshot are saved.

### Mail, extraction, matching, notifications

**Mail** (ADR-022) is read over IMAP, read-only, for the last `JOB_MAIL_LOOKBACK_HOURS`; each e-mail once. The `mail`
step tells its kind from the headers only — sender name, domain, subject:

| E-mail kind | Action |
|---|---|
| Job alert (LinkedIn, Glassdoor, AllJobs, a company's own mailing …) | body fetched, links read like a listing → screen → `extract`; LinkedIn / Glassdoor vacancies take their description from the company's ATS board |
| Recruiter letter | recorded, body not read |
| Anything else | recorded, body not read |

**Extraction** (the `extract` step of the configured provider — Qwen 27B through Ollama's `format`, or Claude Haiku;
JSON by schema): open or closed, title, company, level, country, city, work mode, programming languages required or
nice to have, frameworks, years required, Hebrew (required / advantage / none), short summary. Skills are mapped onto
the same dictionary as the resume. Stored as JSONB with the hash of the page text — an unchanged page is not read
again. Web text is untrusted (ADR-020).

**Dedup:** by URL, and by the normalized pair "company + title" (lowercase, without Ltd/Inc) within one country —
the same title of a company in two countries is two vacancies; a position of unknown country joins either.

**Matching is code, no LLM** — one rule per file against the current resume and the preferences of each profile
(`profile_preferences`): a required programming language the resume has, place and work mode, level, excluded
companies, mandatory Hebrew → `no_fit`; more years than the resume → `almost`; Hebrew as an advantage is a mark.
The worst finding decides: `fit` / `almost` / `no_fit`, each with its reasons. A new resume version re-matches every
extracted vacancy without the LLM.

**Telegram cards, on events:** a `fit` or `almost` vacancy at once, with buttons *Interested*, *Skip*, *Applied*;
a closed or changed vacancy the owner already saw; a stopped source; a company board the discovery found, with
*Add as a source* / *Ignore*. `no_fit` is never sent. Presses are stored and
used to tune the rules; a choice made by a button, in the web UI or through the MCP server is ticked under every
message of its vacancy (ADR-026). The owner sends the CV themselves.

### Queues (BullMQ)

Queues exist for real reasons: per-site rate limits, Ollama serving one request at a time, retries on
failure, and jobs that must survive the Mac's sleep.

| Queue | Does | Specifics |
|---|---|---|
| `search` | scan a source → screened positions; discovery of boards | Job Schedulers: scans every `SEARCH_INTERVAL_HOURS` + jitter, discovery on `DISCOVER_CRON`; `concurrency: 1`, one request at a time per site |
| `email` | read the mailbox → kinds, vacancies of the job alerts | Job Scheduler every `JOB_MAIL_INTERVAL_MINUTES`; `concurrency: 1`; removed until restart when the password is refused |
| `extract` | open a vacancy → JSON → match → save | `EXTRACT_CONCURRENCY` (`1` for Ollama), retries with growing backoff |
| `notify` | cards and notices to Telegram, the tick of a choice under them | `concurrency: 1`, one message a second; sweep of unsent cards and unsynced choices every `NOTIFY_SWEEP_MINUTES` |

Schedules are Job Schedulers. Bull Board is mounted in NestJS as a separate route.
