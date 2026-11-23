---
name: feedback-branch-no-track
description: Create a branch from origin/main with --no-track, or a plain push goes to main
metadata:
  type: feedback
---

Create a new branch as `git checkout -b <branch> --no-track origin/main` — never without `--no-track`.

**Why:** `git checkout -b X origin/main` sets `origin/main` as the upstream of X, so the owner's plain `git push` (or
the IDE's Push) sends the branch's commits to `main`. The ruleset of `main` rejected it, but the owner lost time on it.

**How to apply:** after creating a branch, `git branch -vv` must show no `[origin/main]` next to it; the first push is
`git push -u origin <branch>`, which sets the right upstream. Related: [[feedback-commit-only-on-command]].
