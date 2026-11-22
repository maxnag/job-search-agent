---
name: feedback-short-commit-messages
description: Commit bodies are a few short bullets — what changed, not why or how it was tested
metadata:
  type: feedback
---

A commit message is a short subject plus 2–4 short bullets naming what changed, then `Co-Authored-By`. No rationale, no test inventory, no list of every file or doc touched.

**Why:** the owner wants commits readable at a glance; rationale belongs in the plan or the PR description.

**How to apply:** one line per change, under ~80 characters; leave out tests, docs and JSDoc touch-ups unless they are the change itself.
