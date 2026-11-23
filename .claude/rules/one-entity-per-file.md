---
paths:
  - "apps/**/*.ts"
  - "packages/**/*.ts"
---

# One Entity Per File

> A file has one public identity. Its name declares it, and importing the file imports that one thing.
## The rule

- [ ] **A file exports at most one OOP entity** — one `class`, or one `interface`, or one `type`, or one `enum`.
      The file name is that entity's name in kebab-case (acronyms exploded, see `code-style.md`)
- [ ] **Only `export` declarations count.** A non-exported declaration is an implementation detail of the file's
      public entity
- [ ] **`const` and `function` are not OOP entities** and do not count: a module constant or a helper function
      next to a class is fine
- [ ] The violations this rule exists for: **`export interface` / `export type` next to `export class`**, and
      **two exported classes about different things**

## Private types stay with their class

A non-exported interface or type lives in the file that uses it — moving it to `interfaces/` would force an export
and widen the public surface.

```typescript
// resume-normalization.helper.ts — functions only, a private draft shape
interface ISkillDraft {
  readonly name: string;
  readonly ranges: IMonthRange[];
}

export function normalizeResumeSkills(extraction: ResumeExtractionType, now: Date): IResumeSkill[] { /* … */ }
```

Typical cases: the JSON shape of a third-party API only the calling class parses; the parameter object of a
private method; a working draft inside a helper.

As soon as a second file needs the type, it is no longer private: its own file in `interfaces/`, exported from there.

**Compiler exception:** a type returned or accepted by a public method of an exported class must be exported
(`declaration: true` → TS4053). Such a type goes straight to `interfaces/` (`ProfileRowType` of `ProfileRepository`).

## Exceptions

### Interface files — one topic, any number of interfaces

A `*.interface.ts` file may export several interfaces and type aliases of **one topic** — the whole contract of the
LLM port, the whole `/health` response. Unrelated interfaces are split by topic. A class or an enum in an interface
file is a violation.

```typescript
// llm/interfaces/l-l-m-client.interface.ts — one topic: the LLM port
export interface ISchemaRequest<TOutput> {}
export interface ISchemaResult<TOutput> {}
export interface ILLMHealth {}
export interface ILLMClient {}
```

### DTO files — any number of DTO classes

A `*.d-t-o.ts` file may export several DTO classes of one topic (create / update / response, nested DTOs).
DTO classes only — an interface or an enum in a DTO file is a violation.

### Schema files — the schema and its inferred type

A `*.schema.ts` file exports one Zod schema (`const`) and the type inferred from it (`z.infer`). The type cannot
live apart from the schema it is derived from.

### Enums — one per `*.enum.ts`

- [ ] Every enum is its own file `<name>.enum.ts` — never next to an interface, in a DTO or in a module file
- [ ] Shared enums live in `packages/shared`; an enum one module uses lives in that module's `enums/`
- [ ] A constant derived from the enum (`QUEUE_NAMES` from `QueueNameEnum`) may live in the enum's file — `const`
      does not count
- [ ] Enum values that mirror a database value change together with a migration

### Constants

Exported constants live in a registry file of their topic (`log.constants.ts`) or next to the enum they derive
from. Non-exported constants and regular expressions stay in the file that uses them.

### Out of scope

`*.spec.ts`, `*.e2e-spec.ts`, `scripts/*`, configuration files in the repository root.

## Moving an interface out of a class file — checklist

- [ ] New file in the module's `interfaces/` (`packages/<pkg>/src/interfaces/` for a package): `<topic>.interface.ts`
- [ ] Move the interface **with its JSDoc**, unchanged
- [ ] The class imports it back by a relative path with `.js`
- [ ] A package: one `export *` line in `src/index.ts` (alphabetical), then `pnpm build`
- [ ] `pnpm prettier:fix` — Prettier orders the imports
