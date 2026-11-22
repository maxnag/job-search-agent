# Code Style

## Database naming (applies whichever ORM is chosen)

- [ ] All tables and fields are lowercase `snake_case`
- [ ] Tables are plural (`vacancies`, not `vacancy`)
- [ ] Field names start with the table name in singular form (`vacancies.vacancy_title`, not `title`)
- [ ] Primary and foreign keys end with `_id` (`company_id`, not `companyId`)
- [ ] Every table has `dt_create` (default current timestamp) and `dt_update` (nullable, set on change)
- [ ] Schema changes only through migrations — never schema sync on start

## File Naming

- [ ] Use kebab-case for all file names (e.g., `vacancy-dedup.service.ts`)
- [ ] Follow NestJS conventions: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.d-t-o.ts`, `*.repository.ts`, `*.consumer.ts`, `*.agent.ts`
- [ ] Test files are named `*.spec.ts` and placed alongside the source file
- [ ] Interfaces are prefixed with `I` (e.g., `IVacancy`)
- [ ] DTOs are suffixed with `DTO` (e.g., `CreateVacancyDTO`)
- [ ] Enums are suffixed with `Enum` (e.g., `EmailTypeEnum`, `VacancyStatusEnum`)
- [ ] Agents are suffixed with `Agent` (e.g., `BrowserNavigationAgent`, `EmailTriageAgent`)

## Acronyms

An acronym is written as a unit. Its case is decided by **where it sits**, not by which acronym it is.

- [ ] **PascalCase — class, interface, type, enum: the acronym is fully uppercase in every position.**
      `LLMClientService`, `MCPServerModule`, `HTMLSnapshotService`, `IJSONSchema`, every `*DTO`
- [ ] **camelCase — variable, property, method, parameter: lowercase when the acronym opens the name,
      uppercase anywhere else.** `llmClient`, `htmlSnapshot`, `urlParams` — but `vacancyURL`,
      `parseHTML()`, `jobsDBServer`
- [ ] **Both rules apply to every acronym in the name, independently.** `htmlCSSParser` opens with one
      and carries a second
- [ ] **File names are unaffected.** The file is the name in kebab-case, one segment per capital letter,
      so an acronym explodes: `LLMClientService` → `l-l-m-client.service.ts`, `CreateVacancyDTO` →
      `create-vacancy.d-t-o.ts`
- [ ] **`Id` is not an acronym.** `vacancyId`, `IVacancyId`, `*_id` are correct as written
- [ ] **`Ms` (milliseconds) is a unit, not an acronym.** `timeoutMs`, `delayMs`
- [ ] **Never rename a third-party identifier to satisfy this rule** (`app.getHttpServer()`, `JobsOptions`)

**Why the position matters:** in camelCase the boundary between words is a change of case, and that is
the only signal a reader has. `htmlCSSParser` keeps the seam visible.

## Import Order

- [ ] Imports are sorted automatically by Prettier — never by hand:
  1. Node.js built-in modules (`node:fs`, `node:path`)
  2. External packages (`@nestjs/*`, `bullmq`, `playwright`, etc.)
  3. Workspace packages (`@job-agent/shared`, `@job-agent/db`, …)
  4. Relative imports (`./`, `../`)
- [ ] Each group is separated by a blank line
- [ ] ESM (`module: nodenext`): a relative import carries the `.js` extension of the compiled file —
      `import { VacancyService } from './vacancy.service.js'`, never without an extension or with `.ts`
- [ ] A workspace package is imported by its name (`@job-agent/db`), never by a relative path into another package

## Constants & Magic Numbers

- [ ] Never use magic numbers or hardcoded strings in business logic
- [ ] Queue names, job names, scheduler ids and Redis keys live in one registry — never a literal at the call site
- [ ] Configuration values (rate limits, step limits, schedules, filter rules) come from config / env via `ConfigService`
- [ ] Shared enums live in `packages/shared`

## Function & Method Parameters

- [ ] Max **5 parameters** for any function or method
- [ ] **6 or more** → a single `readonly` params object, declared as an `I…` interface named after the call
      (`IExtractionRequest`, not `IExtractorArgs`)
- [ ] **Constructors are exempt** (DI injection point) and so are **controller handlers whose parameters
      carry Nest decorators**. The exemption is not a licence: a constructor past ~a dozen dependencies
      means the class does too many jobs

## TypeScript Specific

- [ ] Mostly use interfaces instead of types for new code
- [ ] Use `readonly` for all interface properties that should be immutable
- [ ] Use `?` for all optional properties in interfaces
- [ ] Use `as const` for string-literal maps
- [ ] All Enum values are UPPERCASE (e.g., `REMOTE`, `HYBRID`, `JOB_ALERT`)
- [ ] Cast to a number with unary plus — `+params.limit`, never `Number(…)` (except `bigint` / `unknown`)
- [ ] No `any` — use `unknown` and narrow, or a schema-validated type

## NestJS Specific

- [ ] Always use constructor injection, never property injection
- [ ] Use `private readonly` for all injected dependencies
- [ ] Always use `async/await` instead of raw `.then()/.catch()`
- [ ] Never use the `Promise` constructor when `async/await` suffices
- [ ] Always handle promise rejections
- [ ] `Promise.all()` for parallel independent operations, `Promise.allSettled()` when every result is needed regardless of failures

## Comments & Documentation

### Comment minimally

- [ ] **No inline `//` or `/* */` comments in source files, under any justification** — including "non-obvious WHY", hidden constraints or workaround explanations. JSDoc is the only comment form allowed. Rationale belongs in the PR description, the plan or the commit message ([feedback](../../docs/memory/feedback-no-inline-explanatory-comments.md))
- [ ] Never document transient state ("TODO after X", "not yet enforced") in committed code
- [ ] Do not put branch names or plan file paths in code or comments

### JSDoc

- [ ] All classes and methods have JSDoc; all properties have a description:
  ```typescript
  /**
   * Vacancy source URL
   *
   * @var {string}
   */
  ```
  ```typescript
  /**
   * Find a vacancy by its normalized company and title
   *
   * @param {string} company
   * @param {string} title
   *
   * @throws {NotFoundException} If the vacancy is not found
   *
   * @returns {Promise<IVacancy>}
   */
  ```
- [ ] JSDoc tag order is mandatory:
  1. `@param` — first, one per parameter
  2. All other tags (`@template`, `@type`, `@var`, `@deprecated`, …)
  3. `@throws` — penultimate, one per exception
  4. `@returns` — always last
- [ ] A blank line between tag groups

## Examples and sample data

- [ ] Sample data in code, tests, fixtures and docs is fictional — never a real recruiter, a real e-mail address or a real personal phone number
- [ ] Cyrillic examples are Ukrainian, never Russian references ([feedback](../../docs/memory/feedback-no-russian-references.md))
