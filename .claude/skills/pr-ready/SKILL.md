---
name: pr-ready
description: Run the full post-task quality checklist for the current branch — lint, prettier, type check, build and unit tests across the pnpm workspace. Reports a pass/fail summary. Use when the user says "pr-ready", "check if ready", "run checks", or before opening a PR.
allowed-tools: Read, Bash(git *), Bash(pnpm *), Bash(npx *), Bash(node *), Bash(ls *)
---

Run all steps from the repository root. If a script is missing from the root `package.json`, report it as
`— (no script)` rather than inventing a command.

## Step 1 — Run Checks (in order)

```bash
pnpm lint:fix        # 1.1 Lint
pnpm prettier:fix    # 1.2 Prettier
pnpm typecheck       # 1.3 Type check — the only step that checks types
pnpm build           # 1.4 Build
pnpm test            # 1.5 Unit tests
```

---

## Step 2 — Report

```
╔══════════════════════╦════════╗
║ Check                ║ Status ║
╠══════════════════════╬════════╣
║ Lint                 ║ ✅     ║
║ Prettier             ║ ✅     ║
║ Type check           ║ ✅     ║
║ Build                ║ ✅     ║
║ Unit tests           ║ ❌     ║
╚══════════════════════╩════════╝
```

- ✅ = exit code 0
- ❌ = non-zero exit code — show the error output below the table
- If any check fails, **do not mark as ready** — list what needs fixing

---

## Rules

- [ ] Always run checks in order: lint → prettier → type check → build → test
- [ ] Never skip a step
- [ ] If lint/prettier changes files, note it in the summary
- [ ] Do not run e2e tests or anything that touches real sites, Gmail, Telegram or Ollama
- [ ] Do not commit or push — this skill only checks, never writes git history
