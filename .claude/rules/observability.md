# Logging & Error Handling

## Logger Usage

- [ ] Every service / consumer / agent has `private readonly logger = new Logger(ClassName.name)`
- [ ] Pick the level by **who has to act**, never by "an exception was thrown":

| Level | Meaning | Examples |
|---|---|---|
| `error` | the system failed — the owner must act | a job failed after its last retry, Ollama down, a recipe broken and the agent could not repair it |
| `warn` | abnormal but handled or self-healed | a retry, a rate limit hit, a site timeout, an LLM answer repaired by validation |
| `log` | one business event per operation | search run finished (N links), e-mail classified, digest sent |
| `debug` | detail inside an operation | each browser step, each extracted field, queue ticks |
| `verbose` | payload-level tracing | — |

- [ ] Per-item lines inside one operation stay `debug` — at `log` they bury the once-per-operation events
- [ ] Extra fields go in an object — `this.logger.log({ message, site, links })` — never a second string
      to `log`/`warn`/`debug` (the second argument is the context, not data). Only `error(message, stack)` takes a stack

## Where the lines go

- [ ] The API logs through `nestjs-pino`; code keeps `new Logger(ClassName.name)` from `@nestjs/common`
- [ ] Development: one readable line per event (`pino-pretty`); elsewhere JSON on stdout. With
      `OTEL_EXPORTER_OTLP_ENDPOINT` set, lines also go to Loki over OTLP — view them in Grafana (`GRAFANA_PORT`)
- [ ] Loki labels are only the resource attributes (`service_name`, `service_namespace`, environment). A vacancy id,
      a mail `providerId`, a request id or a site are **fields**, never labels — a label per value explodes the index
- [ ] A request line carries method, url, status and duration only — never headers or bodies; `/health` is not logged
- [ ] Secret-shaped keys are redacted by `LOG_REDACT_PATHS` (`@job-agent/shared`) — a new secret field goes there
- [ ] MCP servers write only to stderr — stdout belongs to the protocol

## Log an error once, where its cause is known

- [ ] Never `catch (error) { this.logger.error(error); throw error; }` — log once, at the level above
- [ ] A catch that swallows or translates an error is the only witness of the cause — it keeps its log line,
      and a translated error keeps the original as `cause`

## No personal data in logs

- [ ] **Never log an error object whole** — HTTP client errors carry headers, tokens and bodies. Log `error.message` and `error.stack` only
- [ ] Never an e-mail body, a sender address, an OAuth token, the Telegram bot token or an API key in a log line —
      a mail is identified by its `providerId`, a vacancy by its id; never its subject
- [ ] On a browser failure, save the screenshot and page snapshot to the local error folder (gitignored), and log only its path

## Error Handling

- [ ] Every job error is either retried (transient: timeout, 429, Ollama busy) or failed with a clear reason
      (permanent: schema mismatch after repair, recipe broken) — never silently dropped
- [ ] Error messages carry a code for programmatic handling (`RECIPE_BROKEN`, `EXTRACTION_SCHEMA_INVALID`)
