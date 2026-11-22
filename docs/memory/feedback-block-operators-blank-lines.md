---
name: feedback-block-operators-blank-lines
description: Every if/else/for/while block is braced and has a blank line before and after it
metadata:
  type: feedback
---

All `if`, `else`, `for`, `while`, `for...of`, `for...in` blocks in JS/TS:

1. Use `{}` even for single-line bodies.
2. Have a **blank line before AND after** the block.

**Why:** visual grouping — control flow stays scannable and a second statement never slips into a braceless body.

**How to apply:** every new block in `.ts`/`.js` (apps, packages, tests). An `else if` chain stays compact; the blank line goes before the first `if` and after the final `}`. `switch` is not covered. Fix nearby violations in the same hunk, never refactor unrelated code for style. Could be enforced by `padding-line-between-statements` in ESLint.
