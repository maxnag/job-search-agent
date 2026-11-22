# deps-update

Show the available updates for all packages in the workspace. Update only minor versions (never major). Rules:
- NEVER update packages with pinned versions (no `~` or `^`)
- NEVER bump a `0.x` package's minor — in `0.x` the minor is the breaking position, so it is a major step and goes through its own plan in `.claude/plans/`
- The 7-day `minimumReleaseAge` stays on — never bypass it to get a fresher version
- Show the final update table before applying!

Ensure Node 24 is active — check with `node --version`. Only run `nvm use 24` if the current version is not v24.x.

List outdated packages across the workspace:
```bash
pnpm outdated -r
```

After showing the update table and getting the user's confirmation (`"do it"`, `"go ahead"`, `"you can do it"`), apply within the current ranges and install:
```bash
pnpm update -r          # stays inside the ^ ranges — minor and patch only
pnpm install
```

If `pnpm install` exits with an error (a release-age refusal included):
- STOP immediately — do not proceed further
- Show the full error to the user
- Revert the problematic version bumps in `package.json` / the lockfile before asking how to proceed
