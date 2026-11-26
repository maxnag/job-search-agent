---
paths:
  - "apps/api/src/mcp/**"
  - "apps/api/src/modules/jobs-db/**"
  - "packages/mcp/**"
  - ".mcp.json"
---

# MCP Servers

Why the servers look like this: ADR-023 in [docs/decisions.md](../../docs/decisions.md).

## Where the code lives

- [ ] A server is an entry point `apps/api/src/mcp/<name>.server.ts` over `MCPModule` — a Nest application context,
      never the HTTP app; its tools live in a module of their own (`modules/jobs-db/`)
- [ ] `packages/mcp` holds only the wiring: `startStdioServer`, `MCPServerNameEnum`, `toolResult` / `toolError`.
      A server joins the enum together with its code — no empty entry point
- [ ] The tools module provides what it needs from other modules directly when importing that module would bring
      queues or Redis into the server
- [ ] Every server is listed in `.mcp.json` (no secrets: `--env-file=.env`) and in the Claude Desktop example in `docs/`

## stdout belongs to the protocol

- [ ] One stray byte on stdout breaks the session: no `console.log`, no `process.stdout`; a message of the server
      itself goes to `console.error`
- [ ] The logger of a server is `mcpLoggerParams` (stderr); Nest starts with `logger: ['error', 'fatal']`, then
      `useLogger` of pino
- [ ] A script that builds before the start sends the build output to stderr (`>&2`)
- [ ] The e2e of the server checks that stdout carries only JSON-RPC

## A tool

- [ ] One tool — one class in `tools/`, one operation; its `NAME`, `INPUT` and `OUTPUT` are private constants of the file
- [ ] Names are `snake_case`; input and output are Zod raw shapes, every field with `.describe()` the model can act on
- [ ] The description is written for the model: what it returns, when to call it, which tool to call next
- [ ] Annotations: a read — `READ_ONLY_TOOL`; a write states `readOnlyHint`, `destructiveHint`, `idempotentHint`
- [ ] A list takes `limit` and is capped by `MCP_MAX_ROWS` with `capRows`; the answer carries `total`
- [ ] Dates leave as ISO strings; the answer has no field outside `outputSchema`
- [ ] A tool that returns text from the web ends its description with `UNTRUSTED_TEXT_NOTE` (ADR-020)
- [ ] A query the tool needs is a repository method — never SQL in the tool

## What may be written and returned

- [ ] Writes are only the ones the ADR lists (`record_action`); never a delete, never a change of a vacancy, a source,
      a profile or a setting. A new write is a new ADR
- [ ] A write tool is called only when the owner asks for it in the conversation — its description says so
- [ ] Never returned: secrets, `llm_settings`, the body, subject or address of an e-mail

## Errors

- [ ] A refusal the client can act on throws `JobsDBToolError` with a code (`VACANCY_NOT_FOUND`) and a sentence for
      the model; it is answered with that code and not logged as a failure
- [ ] Any other failure is logged once by the runner of the tools service, with its cause, and answered `TOOL_FAILED`
      — the client never sees a stack, a query or a message of a driver
- [ ] The input is validated by the SDK from `INPUT`; a tool never re-validates it by hand

## Tests

- [ ] Each tool: a unit spec through `registerJobsDBTool` (`apps/api/test/jobs-db-tool.harness.ts`) — the real
      schemas, the cap, the refusal; the queries — e2e of the repository
- [ ] `apps/api/src/mcp/*.server.ts` are left out of the unit coverage; the stdio e2e covers them
