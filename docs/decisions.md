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
