# Dependencies & Versions

## pnpm and the 7-day release delay

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days, in minutes): pnpm refuses any version
published less than a week ago, and fails the install when no matching version is old enough.

- [ ] Write ranges in `package.json` (`^12.0.0`), never "the newest" exact version — the newest may be too fresh
- [ ] An urgent security patch goes through `minimumReleaseAgeExclude`, named per package, and is removed once the version is a week old
- [ ] Workspace packages (`workspace:*`) are not delayed
- [ ] Never add a package without checking its peer dependencies against NestJS 12 by an actual install
- [ ] The same rule applies to Docker images: no image tag younger than a week (PostgreSQL stays on 18 until 19 is proven)

## Pinned choices

| Package | Rule |
|---|---|
| `ioredis` | installed explicitly; `^6`, fallback `^5.4`. In ESM: `import { Redis } from 'ioredis'` |
| `bullmq` | v6 — no legacy repeatable jobs, schedules only via `upsertJobScheduler`; worker connections use `maxRetriesPerRequest: null` |
| Node.js | 24 LTS (`.nvmrc`) |

## Updating

- [ ] Updates go through the `deps-update` command: minor versions only, table first, apply after confirmation
- [ ] A major upgrade is its own plan in `.claude/plans/`, never a side effect of an update
