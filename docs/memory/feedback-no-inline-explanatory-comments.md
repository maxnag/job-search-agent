---
name: feedback-no-inline-explanatory-comments
description: Never add inline // or /* */ comments in source files; only JSDoc on classes, properties and methods
metadata:
  type: feedback
---

Do not write inline `//` or `/* */` comments in source files — for any reason, including "non-obvious WHY", hidden constraints or workaround explanations. The only permitted comments are JSDoc blocks on classes, methods and properties (formats in `.claude/rules/code-style.md`).

**Why:** after long investigations generated diffs kept accumulating multi-line comment blocks restating the investigation. A "comment only the non-obvious WHY" allowance gets exercised on nearly every line, so the rule is unconditional.

**How to apply:** put reasoning into the plan, the PR or the commit description, never into the file. JSDoc stays required.
