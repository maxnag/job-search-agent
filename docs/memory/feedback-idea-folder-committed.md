---
name: feedback-idea-folder-committed
description: The .idea folder is always committed — shared JetBrains editor settings, data sources included
metadata:
  type: feedback
---

`.idea/` is part of the repository and goes into commits with the rest of a change — editor and project settings
for JetBrains IDEs, including `dataSources.xml` and other files the IDE adds. Personal files are already excluded
by `.idea/.gitignore` (`workspace.xml`, `shelf/`, `dataSources.local.xml`, `dataSources/`, …).

**Why:** the owner keeps the IDE setup in git on purpose; flagging `.idea` files as "probably personal" was wrong.

**How to apply:** include `.idea` changes in commits without asking; only check them for secrets first (the repo is
public) — connection URLs are fine, passwords live in `dataSources.local.xml` or the OS keychain, which are ignored.
