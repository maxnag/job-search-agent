# Memory

## Behavior Rules & Lessons Learned

- Core rules live in `.claude/rules/project-knowledge.md` — auto-loaded every session (confirmation rule, braces, Promise.allSettled, testing patterns, bootstrap lessons).

- [Short commit messages](feedback-short-commit-messages.md) — subject + 2–4 short bullets of what changed; no rationale, no test/docs inventory
- [No inline explanatory comments — JSDoc only](feedback-no-inline-explanatory-comments.md) — never add inline `//`/`/* */` comments, even after a long investigation
- [Block operators: braces + blank lines](feedback-block-operators-blank-lines.md) — every if/else/for/while gets `{}` and a blank line before and after
- [No Russian references in artifacts](feedback-no-russian-references.md) — no `РФ`/`ru-RU`/Russian samples in code or docs; Cyrillic examples are Ukrainian
