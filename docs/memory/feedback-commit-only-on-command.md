---
name: feedback-commit-only-on-command
description: Never commit on my own — not even inside an approved plan; commit only when the owner explicitly says to
metadata:
  type: feedback
---

Never run `git commit` on my own initiative. "do it" on a plan approves the code changes, not the commits — the
owner reviews every change in the working tree first and then explicitly asks for a commit (e.g. "commit", "закоммить").

**Why:** the owner checks everything before it enters history; commits made during implementation skipped that review
(happened in phase 2: two commits were created on the feature branch without being asked).

**How to apply:** implement, run the checks, leave the changes uncommitted, report what changed and propose a commit
message; run `git commit` only after an explicit request. The same holds for `git push`, branches being merged and
PRs. Plans may still list the intended commits — listing is not permission. Related: [[feedback-short-commit-messages]].
