---
name: docs-sync
description: >
  Sync project documentation with the current branch. Diffs the branch against main, maps changed
  files to affected docs in docs/, CLAUDE.md and .claude/rules/, reads both the changed code and the
  stale docs, then proposes targeted updates and waits for confirmation before writing anything. Use
  when the user says "sync docs", "update docs", "docs are stale", or after a feature or fix is done.
allowed-tools: Read, Edit, Bash(git *), Bash(grep *), Glob
---

The workflow is: **diff → map → read → propose → confirm → write**.

## Step 1 — Get the diff

```bash
git diff --name-only $(git merge-base main HEAD)
git status --short
git log main...HEAD --oneline
```

A diff against the merge-base covers committed, staged and unstaged changes together.

## Step 2 — Map changed files to affected docs

| Changed file pattern | Affected docs |
|---|---|
| `packages/db/**` (schema, migrations) | `docs/project-brief.md` → data model |
| `**/consumers/**`, queue / scheduler registry | `docs/project-brief.md` → queues |
| `**/agents/**`, `**/prompts/**` | `docs/project-brief.md`, `docs/decisions.md` if the approach changed |
| `packages/mcp/**` | `docs/project-brief.md` → MCP servers |
| filter / dedup rules, config schema | `docs/project-brief.md` → filters |
| `.env.example`, `package.json`, `pnpm-workspace.yaml` | `docs/tech-context.md` |
| `docker-compose.yml` | `docs/tech-context.md` |
| Root scripts | `CLAUDE.md` → Commands |
| New architectural decision | `docs/decisions.md` |

**Always check `CLAUDE.md`** — its "Last synced commit" line moves to the latest commit.

**Always check the master plan** in `.claude/plans/` — tick every open question the branch answered and update
the phase status. The plan is exempt from confirmation; the decision itself still goes into `docs/` or
`.claude/rules/` through the proposal below.

**Also check `.claude/rules/`** when the change introduces a convention that is not captured there yet.

## Step 3 — Read

For each affected doc read the whole doc and the diff of the changed files
(`git diff main...HEAD -- <file>`), not just the current file.

## Step 4 — Identify what is stale

Missing, wrong, or fine. Be conservative: only propose changes for things that are genuinely incorrect or
missing — no rewrites of accurate sections.

## Step 5 — Propose

Per doc: the section, the exact addition / replacement, and the reason (which changed file). Show all of
them, then ask: **"Reply _do it_ to apply these changes."** Wait for `"do it"`, `"go ahead"` or `"you can do it"`.

## Step 6 — Apply and report

Apply with `Edit`, one doc at a time; update the `Last synced commit` hash (`git rev-parse --short HEAD`).
Then print which docs changed and which were checked and left unchanged.

## Rules

- Never write without the confirmation phrases
- Never rewrite docs wholesale
- Never name a plan file in a doc
- When unsure whether a section is stale, ask instead of proposing
