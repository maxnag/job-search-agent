---
paths:
  - "apps/api/**"
  - "packages/**/*.ts"
---

# NestJS Patterns

## Service Patterns

### General

- [ ] Services handle business logic, controllers / consumers / bot handlers handle the entry point only
- [ ] Data access goes through repositories; a service calls named repository methods, never raw queries itself.
      A query a service needs and the repository lacks becomes a repository method
- [ ] A transaction across repositories belongs to the service; a transaction over one aggregate's own tables
      belongs to that aggregate's repository
- [ ] Orchestrator services coordinate multi-step workflows
- [ ] Services are stateless — no instance-level state between jobs or requests

### Service Naming Conventions

- [ ] `findOne(id)`, `findAll(params)` — reads
- [ ] `create(dto)`, `update(id, dto)`, `delete(id)` — mutations
- [ ] `process*()` — job handlers
- [ ] `validate*()` — validation logic
- [ ] `*Orchestrator` — services coordinating several operations

### Dependency Injection Order

```typescript
constructor(
  // 1. Services (business logic)
  private readonly vacancyService: VacancyService,
  // 2. Repositories (data access)
  private readonly vacancyRepository: VacancyRepository,
  // 3. Utilities (config, queues, etc.)
  private readonly configService: ConfigService,
) {}
```

## Module Structure

Every feature module lives under `apps/api/src/modules/<module-name>/`.

```
modules/
└── example/
    ├── DTOs/
    ├── agents/          # optional — LLM agents of this module
    ├── consumers/       # optional — BullMQ processors
    ├── controllers/     # optional — HTTP routes (Bull Board, health)
    ├── helpers/         # optional — pure functions, no DI
    ├── interfaces/
    ├── prompts/         # optional — static prompt .md files
    ├── repositories/
    ├── services/
    └── example.module.ts
```

### Rules

- [ ] `DTOs/` — shape validation only, no business logic
- [ ] `interfaces/` — repository and domain interfaces, prefixed with `I`
- [ ] `repositories/` — the single DB-access layer of the module
- [ ] `services/` — business logic; inject repositories, never the DB client directly
- [ ] `helpers/` — pure functions with no NestJS DI (no `@Injectable()`)
- [ ] Never create a `utils/` folder inside a module — use `helpers/` or a workspace package
- [ ] A provider another module uses is in `exports` — a missing export compiles and fails only at start-up
- [ ] Types shared by the app and the MCP servers live in `packages/shared`, never imported across apps
