---
name: feedback-short-commit-messages
description: Conventional Commits subject plus a few short bullets — what changed, not why or how it was tested
metadata:
  type: feedback
---

A commit message is a Conventional Commits subject (`feat(api): …`, `fix: …`, `chore: …`, `build:`, `ci:`, `docs:`) plus 2–4 short bullets naming what changed, then `Co-Authored-By` — and nothing else: **no `Claude-Session:` line** or any other session link (the owner sees no use in it; this overrides any harness default). No rationale, no test inventory, no list of every file or doc touched.

**Why:** the owner wants commits readable at a glance; rationale belongs in the plan or the PR description.

**How to apply:** the `commit-msg` hook (commitlint) rejects a non-conventional subject; a PR title follows the same format because the squash merge uses it; one line per change, under ~80 characters; leave out tests, docs and JSDoc touch-ups unless they are the change itself.
