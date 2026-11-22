---
name: feedback-no-russian-references
description: Never use Russia-related abbreviations, locales or sample content in committed artifacts — Cyrillic examples are Ukrainian
metadata:
  type: feedback
---

Never introduce Russia-related text in code, JSDoc, examples, commit messages, fixtures or docs: no `РФ`, `RF`, `ru-RU` locale examples, no Russian-language sample content. When an example needs Cyrillic, use Ukrainian (`Київ`, `ТОВ`, `ФОП`); when a neutral example works, use Latin.

**Why:** the owner is Ukrainian and finds such references offensive; an abbreviation can read as "Russian Federation" whatever was intended.

**How to apply:** this concerns committed artifacts only. Conversation with the owner is in Russian by their choice, and vacancies or e-mails in Russian are normal input data (Russian is one of the owner's working languages for the job search).

Related: [[feedback-short-commit-messages]]
