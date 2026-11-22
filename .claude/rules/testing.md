---
paths:
  - "**/*.spec.ts"
  - "**/*.e2e-spec.ts"
  - "**/test/**"
---

# Testing Requirements

- [ ] Do not write tests without the user's command
- [ ] When a task and the code are ready, the user will ask for tests

## Unit Tests

- [ ] An init unit test for a created file has one case — should be defined (`expect(service).toBeDefined()`)
- [ ] Mock all external dependencies: Postgres, Redis, Ollama, Anthropic API, Gmail API, Telegram, Playwright
- [ ] Use `@nestjs/testing` `TestingModule` for service/controller tests
- [ ] Test error cases and edge scenarios, not only the happy path
- [ ] Filters and dedup are pure code — every rule has cases it applies to, cases it leaves alone, and its boundaries

## E2E Tests

- [ ] All 3rd-party calls are mocked — never a real site, a real mailbox or a real Telegram chat
- [ ] Run against a separate test database, never the dev one

## Patterns & Conventions

- [ ] Spy with `vi.spyOn()`, never reassign a method
- [ ] Runner is Vitest with `unplugin-swc` (decorator metadata for Nest DI); test env comes from `.env.example`
      plus placeholders in `vitest.config.mts` — a spec never reads `.env` and never a real secret
- [ ] ConfigService mocking — key switch, never `mockReturnValue` (see [project-knowledge.md](project-knowledge.md))
- [ ] No snapshots for rules; snapshots only guard prompt bytes and rendered digest messages
- [ ] Fixtures are fictional: a saved career page or e-mail is anonymised before it enters the repository —
      no real names, addresses or tracking tokens

## When specs fail after a change of logic

A failing spec is a question, not a chore: either the code broke a rule, or a decision changed the rule.
Never make a spec pass by copying the new output into it.

- [ ] Run the whole suite first and list every failing expectation before editing any spec
- [ ] Bring the user a table — spec › test, old expectation, new output, the decision that changes it.
      A row nobody can name a decision for is a defect in the code
- [ ] Change only what the table names; run each fixed spec again

## Before reporting tests done

- [ ] The full suite passes
- [ ] `tsc` passes over the changed specs (Vitest's transform checks no types — `pnpm typecheck` does)
- [ ] `eslint` and `prettier --check` on every changed file, specs and fixtures included
