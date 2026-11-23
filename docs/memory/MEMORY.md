# Memory

## Behavior Rules & Lessons Learned

- Core rules live in `.claude/rules/project-knowledge.md` — auto-loaded every session (confirmation rule, braces, Promise.allSettled, testing patterns, bootstrap lessons).

- [Experiments on the test DB](feedback-experiments-on-test-db.md) — probes and verification write to job_agent_test and a scratch storage, never the dev DB
- [Commit only on command](feedback-commit-only-on-command.md) — never commit on my own, even under an approved plan; leave changes for the owner to review
- [.idea is committed](feedback-idea-folder-committed.md) — JetBrains settings always go into commits; just check them for secrets
- [Short commit messages](feedback-short-commit-messages.md) — Conventional Commits subject + 2–4 short bullets of what changed; no rationale, no test/docs inventory
- [No inline explanatory comments — JSDoc only](feedback-no-inline-explanatory-comments.md) — never add inline `//`/`/* */` comments, even after a long investigation
- [Block operators: braces + blank lines](feedback-block-operators-blank-lines.md) — every if/else/for/while gets `{}` and a blank line before and after
- [No Russian references in artifacts](feedback-no-russian-references.md) — no `РФ`/`ru-RU`/Russian samples in code or docs; Cyrillic examples are Ukrainian
