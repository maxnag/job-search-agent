# Workflow Checklists

> These rules apply to ALL tasks. Claude must follow these requirements.

## Pre-Flight Checks (Before Writing Code)

- [ ] Think broadly about all possible solutions that are feasible and efficient
- [ ] Consider edge cases and potential errors
- [ ] Ensure code is maintainable and scalable
- [ ] Always read documentation and existing code before writing new code
- [ ] Use Context7 MCP (or the library's official docs) to check library APIs — NestJS 12, BullMQ 6 and ioredis 6 changed APIs; never write them from memory
- [ ] Check [CLAUDE.md](../../CLAUDE.md) and related documentation in `docs/` for architecture patterns
- [ ] Never commit the code without user approval
- [ ] Start all tasks in plan mode, never write code without approval and a plan (what counts as approval, and what is exempt: the confirmation rule in [project-knowledge.md](project-knowledge.md))

---

## Plans are local — never link to them

`.claude/plans/` is gitignored (only `.gitkeep` is committed), so a plan file exists on one machine
only and any reference to it is a dead link for everyone else.

- [ ] Never name a plan file in committed content — code, JSDoc, `docs/`, `.claude/rules/`,
      `CLAUDE.md`, commit messages, or PR descriptions
- [ ] Never write "see Decision N in <plan>" — restate the reasoning where it is needed, or promote
      it to an ADR in `docs/decisions.md` if it must be discoverable
- [ ] Naming the `.claude/plans/` **directory** as a process instruction is fine; naming an
      individual plan file is not

---

## Plans folder layout

`.claude/plans/` sits at the repository root. Its root holds only the plans that are still open, so
`ls .claude/plans` is the list of work in progress; every closed plan lives in `archive/`.

```
.claude/plans/
├── YYYY-MM-DD-master-plan.md              the project's master plan: phases, progress, open questions
├── YYYY-MM-DD-<topic>.md                  open single plan
├── <stage-or-feature-slug>/               open multi-phase work, named after its branch
│   ├── YYYY-MM-DD-<topic>.md              master plan
│   └── YYYY-MM-DD-phase-N-<topic>.md
└── archive/
    └── YYYY/                              the year the plan was closed
        ├── YYYY-MM-DD-<topic>.md
        └── <stage-or-feature-slug>/
```

### Language

- [ ] Plans are written in **Russian**. The head keys (`Status`, `Created`, `Implemented`, `Branch`, `Author`),
      the status values, file names, code identifiers, commands and paths stay in English
- [ ] Everything outside `.claude/plans/` that is committed stays in English

### Master plan

- [ ] The project has one master plan in the root of `.claude/plans/`: the phases, their status, and the open
      questions not decided yet. Phases and open questions never go into `CLAUDE.md` or `docs/`
- [ ] A phase that starts gets its own plan (or folder); the master plan links to it and marks the phase
      `⏸️ In Progress`, and `✅` once it is merged
- [ ] An answered open question is ticked in the master plan; the decision itself moves where it belongs —
      an ADR in `docs/decisions.md`, a rule in `.claude/rules/`, a fact in `CLAUDE.md` / `docs/`
- [ ] The master plan stays in the root until the project's last phase is closed

### Creating a plan

- [ ] A single plan goes into the root: `YYYY-MM-DD-<topic>.md`, the date of creation
- [ ] Work with phases gets a folder named after its branch without `feature/`: the branch
      `feature/mvp-digest` → the folder `mvp-digest/`
- [ ] Any plan whose branch is cut from that feature branch lives in that folder — a phase and a bug
      found while verifying a phase alike
- [ ] A plan written in plan mode under a generated name (`<word>-<word>-<animal>.md`) is saved under the
      `YYYY-MM-DD-<topic>.md` name — a generated name is never kept

### Writing a plan — objective content

- [ ] A plan is objective: it states the rule, the cause in the code and a reproducible scenario — never
      records of one local environment: a vacancy id, a row of a dev database, a log line with a real id,
      a real e-mail, a recruiter's name
- [ ] A symptom is written as roles: "a vacancy seen first in an e-mail, then on the career page"; a log
      line as its template (`Vacancy <id> extracted`)
- [ ] The verification steps describe the data to prepare, not the data that happens to exist
- [ ] Concrete ids belong to the diagnosis in the conversation; they never move into a plan

**Why:** test data is deleted; a plan read months later must still make sense and be reproducible on any
database.

### Finding a plan

- [ ] Search recursively — the root, the feature folders and `archive/`: `find .claude/plans -name '*.md'`,
      `grep -rl '<topic>' .claude/plans`; never only the root

### Closing a plan

- [ ] Before closing, confirm the merge: `gh pr list --state merged --head <branch>` (or `gh pr view
      <number>`); without a PR — `git branch --merged main`
- [ ] A squash merge leaves no common history — diff the branch against the merge commit, never against
      `main`, which moves on with the next merge
- [ ] Update the head: `Status: ✅ Implemented` (or `❌ Cancelled`), `Implemented: YYYY-MM-DD`; add a
      `## Closed (YYYY-MM-DD)` section with the pull request (or merge commit)
- [ ] A single plan moves to `archive/<YYYY>/` right after the head is updated
- [ ] A phase plan stays in its feature folder; the folder moves to `archive/<YYYY>/` as a whole once the
      feature branch is merged into `main`, and every plan in it is closed together with the master
- [ ] A closed plan that changes again moves back out of `archive/` with `Status: ⏸️ In Progress`

### Moving or renaming a plan

- [ ] Keep the file name — the date prefix and the topic — when a plan moves into a folder
- [ ] After every move or rename, search the plans for the old name and rewrite each relative link
- [ ] Finish only when every plan path written in a plan exists

### Confirmation

- [ ] Creating, editing, closing and moving plans inside `.claude/plans/` needs no confirmation — the
      exemption in [project-knowledge.md](project-knowledge.md); the git commands a closing involves keep
      their own confirmation

---

## Branches and commits

- [ ] Never work on `main` directly — branch first: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`
- [ ] Commit messages are Conventional Commits (`feat(api): …`, `fix: …`, `chore: …`, `build:`, `ci:`, `docs:`),
      short — subject + 2–4 bullets of what changed; the `commit-msg` hook rejects anything else. The trailer is
      `Co-Authored-By` only — never a `Claude-Session:` line or another session link:
      [feedback-short-commit-messages.md](../../docs/memory/feedback-short-commit-messages.md)
- [ ] Never commit `.env`, tokens, Gmail OAuth credentials, Telegram bot token, real e-mails or real
      vacancy dumps with personal data
- [ ] A PR title is a Conventional Commit too — the squash merge turns it into the commit release-please reads
- [ ] Versions, `CHANGELOG.md` and tags change only through the release PR of release-please — never by hand

---

## Post-Task Checklist

- [ ] All linting errors fixed (`pnpm lint:fix`)
- [ ] Code is formatted (`pnpm prettier:fix`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] Application starts without errors — a green build proves nothing about bootstrap
- [ ] Unit tests pass (when applicable)
- [ ] Documentation updated if needed (`docs-sync` skill)

---

## Code Review Checklist (Self-Review Before PR)

### Functionality

- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled?
- [ ] Are error scenarios handled gracefully (retries, timeouts, a site that changed)?

### Code Quality

- [ ] Is there any duplicated code that should be extracted?
- [ ] Are function/method names descriptive and accurate?
- [ ] Is the code readable without excessive comments?
- [ ] Does it follow existing patterns in the codebase?

### Project Specific

- [ ] Does any LLM call decide whether a vacancy fits? It must not — that is a filter or the human
- [ ] Is every external request rate-limited and time-limited?
- [ ] Are DTOs / LLM outputs validated with a Zod schema before use?
- [ ] Does any log line carry an e-mail body, an address or a token? It must not
