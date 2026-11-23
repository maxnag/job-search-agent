# Project Brief

## Goal

The agent collects vacancies from websites and from e-mail subscriptions, structures them and sends a
digest. **The decision "fits / does not fit" belongs to the human, not to the agent.**

- **Why:** real help with the job search, and a portfolio project (AI agents, MCP, queues)
- **Geography:** Israel (priority — whole country, full-time / hybrid) and Ukraine (remote)
- **Languages:** English (working), Ukrainian, Russian. Hebrew is weak, so vacancies with mandatory Hebrew are filtered out
- **Timeline:** 3–4 days to build, about a month of job search
- **Runs on:** the owner's Mac (Apple Silicon, 64 GB)

## Inputs

1. **The resume** — `pnpm cv:import <file> --profile <name>`. The LLM extracts skills (with a kind and years),
   experience and spoken languages; the latest version of a profile's resume is the source of truth for matching
2. **Vacancies** — from career pages and from job-alert e-mails, extracted into the same fields and compared with the
   profile by code

## Architecture

Hybrid: agents where the path differs every time (site navigation, reading an e-mail), ordinary code
everywhere else. The LLM does not evaluate vacancies — it only understands text and extracts data.

Both channels converge into one extraction and one set of filters. Agent tools are MCP servers —
`browser`, `gmail`, `jobs-db`, `notify` — and the same servers plug into Claude Desktop to ask about the
owner's applications in plain words.

**LinkedIn and Glassdoor are not scraped:** it violates their terms and risks the account. Their vacancies
arrive only through Job Alert e-mails, and the data is taken from the e-mail itself.

### Browser agent for career pages

The LLM drives Playwright once per site; afterwards code replays the saved **recipe** without an LLM.

1. **Open** the career page in headless Chromium
2. **Detect the type:** a vacancy list → step 4; a search form (location, department, keywords) → step 3;
   an embedded ATS (Comeet, Greenhouse, Lever) → take vacancies through its public API
3. **Fill the filters:** the agent gets a simplified page snapshot (labelled elements) and calls `select`,
   `click`, `type`, `scroll`. Values come from config (locations `Israel, Tel Aviv, Remote`, departments
   `R&D, Engineering, Development`); the agent picks the closest options
4. **Collect links:** paginate and press "Load more" until vacancies run out
5. **Each link → the `extract` queue.** No agent there: code opens the page, Qwen returns JSON
6. **Save the recipe** to the database: the action sequence or the final URL with parameters. The agent is
   re-engaged only when the recipe stops working

**Guardrails:** at most 15 steps per site, timeouts, a pause of several seconds between requests, runs 1–2
times a day. On failure a screenshot and a page snapshot are saved.

### Mail, extraction, filters, digest

The mail agent classifies the e-mail (Qwen 9B) and picks an action:

| E-mail type | Action |
|---|---|
| Vacancy digest (LinkedIn, AllJobs, Drushim, Djinni, DOU) | take links → `extract`; for LinkedIn the data comes from the e-mail |
| Recruiter reply | find the application, update its status, notify |
| Interview invitation | notify with date and time |
| Rejection | update status |
| Anything else | skip |

**Extraction** (Qwen 27B, JSON by schema through Ollama's `format`): title, company, city, format (remote /
hybrid / office), stack, level, language requirements, salary, short description. Stored as JSONB.

**Dedup:** by URL, and by the normalized pair "company + title" (lowercase, without Ltd/Inc).

**Filters are code, no LLM;** rules are config: required stack, location, no mandatory Hebrew, level,
exclusion list.

**Telegram digest:** vacancies that passed the filters, with buttons *Interested*, *Skip*, *Applied*.
Presses are stored and used to tune filters. The owner sends the CV themselves.

### Queues (BullMQ)

Queues exist for real reasons: per-site rate limits, Ollama serving one request at a time, retries on
failure, and jobs that must survive the Mac's sleep.

| Queue | Does | Specifics |
|---|---|---|
| `search` | search a site → list of links | per-site rate limiter, schedule 1–2 times a day |
| `email` | read an e-mail → links or a status | schedule every 30 minutes |
| `extract` | open a vacancy → JSON → save | `concurrency: 1`, retries with growing backoff |
| `notify` | digest and messages to Telegram | — |

Schedules are Job Schedulers. Bull Board is mounted in NestJS as a separate route.
