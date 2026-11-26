---
paths:
  - "**/*.spec.ts"
  - "**/*.e2e-spec.ts"
  - "**/test/**"
  - "vitest.config.mts"
---

# Testing Requirements

- [ ] Do not write tests without the owner's command; when a task and the code are ready, the owner asks for them
- [ ] **Every file with logic has its own spec** next to it: `experience.helper.ts` → `experience.helper.spec.ts`.
      A file without logic (an interface, an enum, a module that only wires providers) needs none

## Unit tests

- [ ] A created class has at least `should be defined`
- [ ] Mock every external dependency: Postgres, Redis, the LLM providers (Anthropic, Ollama), Gmail, Telegram,
      Playwright, the file system where a test would write outside a temporary directory
- [ ] `@nestjs/testing` `TestingModule` for services, controllers and repositories
- [ ] Error cases and boundaries, not only the happy path
- [ ] A transaction is mocked and its callback covered
- [ ] Runner: Vitest with `unplugin-swc` (decorator metadata for Nest DI); the env comes from `.env.example` plus
      placeholders in `vitest.config.mts` — a spec never reads `.env` and never a real secret

## E2E tests

- [ ] Every third-party call is mocked — never a real site, mailbox, Telegram chat or LLM
- [ ] Repositories are checked by e2e against the **test database** `job_agent_test`, never by mocking SQL;
      `pnpm db:migrate:test` before the first run and after every new migration
- [ ] An e2e that writes or cleans tables starts with a guard: the connection string must name a `*_test` database,
      otherwise the spec throws before the first query

## Patterns

### Mocks — `createMock<T>()` from `@golevelup/ts-vitest`

```typescript
import { createMock } from '@golevelup/ts-vitest';

{ provide: LLMClient, useValue: createMock<LLMClient>() }
```

Never `vi.fn()` objects assembled by hand for a class — `createMock<T>()` keeps the mock typed. Its methods are
created lazily and are already mocks, so `vi.spyOn()` cannot see them: type the variable `DeepMocked<T>` and configure
the method itself — `repository.findOne.mockResolvedValue(row)`, `expect(repository.findOne).toHaveBeenCalledWith(…)`.
A module that creates its client itself (the Anthropic SDK, `ollama`, `unpdf`, `ioredis`) is replaced with `vi.mock()`.

### Spies on real objects — `vi.spyOn()`, never reassign

```typescript
// ❌ triggers @typescript-eslint/unbound-method
expect(bot.sendMessage).toHaveBeenCalled();

// ✅ the spy exists BEFORE the method under test runs
const sendSpy = vi.spyOn(bot, 'sendMessage');
await service.sendDigest(vacancies);
expect(sendSpy).toHaveBeenCalled();
```

### ConfigService — a key switch, never `mockReturnValue`

A real `ConfigService` with `get` spied — the shared helper `apps/api/test/config-service.mock.ts`:
`createConfigMock({ NODE_ENV: 'production' })`.

```typescript
vi.spyOn(configService, 'get').mockImplementation((key: string) => {
  if (key === 'NODE_ENV') {
    return 'production';
  }

  return undefined;
});
```

`mockReturnValue` returns one value for every key — the branches gated by configuration stay uncovered.

### Minimum coverage by kind of file

| File | Minimum |
|---|---|
| Service, orchestrator | `should be defined` + each public method: happy path + error or boundary + transaction |
| Controller | `should be defined` + each handler: success + error |
| Helper (pure functions) | each exported function: the cases a rule applies to, the cases it leaves alone, its boundaries |
| Repository | e2e against `job_agent_test` — left out of the unit coverage (`**/repositories/**`), never unit-tested |
| Consumer (BullMQ) | `should be defined` + `process()` success and failure + `onFailed()` + `onCompleted()` |
| Guard / filter / interceptor | `should be defined` + allows + blocks |

### Base structure

```typescript
import { createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('ClassName (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ClassName;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [ClassName, { provide: DepA, useValue: createMock<DepA>() }]
    }).compile();

    subjectUnderTest = moduleFixture.get(ClassName);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });
});
```

### Run

```bash
pnpm test                                                   # every unit spec
pnpm test:coverage                                          # with coverage → coverage/ (gitignored), thresholds checked
pnpm test apps/api/src/modules/resume/helpers/experience.helper.spec.ts   # one file
```

## Tests that pin a rule

- [ ] The case is written from the rule's text and its expected values are decided **before** running
- [ ] Each rule has cases it applies to, cases it leaves alone and its boundaries (a threshold from both sides)
- [ ] Through the public entry point, never a private function
- [ ] No snapshots for rules; a snapshot only guards prompt bytes — every static prompt file has a golden snapshot
- [ ] Fixtures are fictional: no real names, e-mails, phone numbers or vacancy dumps of a local run

## Does each test catch its rule — mutation check

- [ ] One mutation at a time: copy the file to the scratchpad, change one line of the rule, run its spec, copy the
      file back and `cmp` it against the copy. Never `git checkout`, `git restore` or `git stash` to undo
- [ ] A surviving mutant is a finding: a missing case, or a rule checked twice

## When specs fail after a change of logic

A failing spec is a question, not a chore: either the code broke a rule, or a decision changed the rule.
Never make a spec pass by copying the new output into it.

- [ ] Run the whole suite first and list every failing expectation before editing any spec
- [ ] Bring the owner a table — spec › test, old expectation, new output, the decision that changes it.
      A row nobody can name a decision for is a defect in the code
- [ ] Diagnose from the code that runs, not from the symptom
- [ ] Change only what the table names; run each fixed spec again

## Before reporting tests done

- [ ] The full suite, then `pnpm test:coverage` — the thresholds are checked only with coverage
- [ ] `pnpm typecheck` — it covers the specs (each package's `tsconfig.json` includes them)
- [ ] `pnpm lint` and `pnpm prettier` on every changed file, specs and fixtures included
- [ ] Coverage thresholds sit 2 points below the measured coverage, rounded down — raise them when coverage rises
