---
paths:
  - "**/llm/**"
  - "**/agents/**"
  - "**/prompts/**"
---

# LLM Calls

## The port, not the provider

- [ ] Agents and extractors depend on the `LLMClient` port (`apps/api/src/modules/llm`), never on
      `@anthropic-ai/sdk` or `ollama` directly — the provider is `LLM_PROVIDER`, a setting, not code
- [ ] A new provider is a new adapter extending `LLMClient`, bound in `LLMModule`; callers do not change
- [ ] The model and its parameters come from `llm_settings` (provider + step) through `LLMSettingsService`, never a
      literal at the call site; a new step is a `LLMStepEnum` value plus a seed row
- [ ] Provider parameters are validated by the provider's Zod schema (`schemas/*-params.schema.ts`); Anthropic has no
      temperature — thinking and effort only
- [ ] Every request has a timeout (`LLM_TIMEOUT_MS`) and the step's `max_tokens`; an answer cut by it is
      `LLM_OUTPUT_TRUNCATED`, never parsed

## Structured output

- [ ] One Zod schema per answer: it becomes the provider's JSON Schema (Anthropic `output_config.format`,
      Ollama `format`) and validates the answer on the way back
- [ ] The answer is always validated with that schema, even when the provider promises structured output —
      a mismatch is `LLM_OUTPUT_SCHEMA_INVALID`, a permanent job failure after the repair attempt
- [ ] The LLM extracts and classifies; it never scores a vacancy or decides whether it fits (ADR-002)

## Health and cost

- [ ] Health checks never spend tokens: Anthropic — `models.retrieve`, Ollama — `GET /api/tags`
- [ ] An unreachable LLM never stops the application from starting; it is reported by `/health`
- [ ] Never log a prompt or an answer that carries an e-mail body or personal data — log ids and sizes
