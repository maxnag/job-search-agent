import { z } from 'zod';

import { LogLevelEnum } from '@job-agent/shared';

import { LLMProviderEnum } from '../modules/llm/enums/l-l-m-provider.enum.js';

/**
 * Treat an empty value (`KEY=` in `.env`) as a missing one
 *
 * @param {unknown} value
 *
 * @returns {unknown}
 */
function emptyToUndefined(value: unknown): unknown {
  return value === '' ? undefined : value;
}

/**
 * Positive integer read from a string variable
 *
 * @returns {z.ZodCoercedNumber<unknown>}
 */
function positiveInt() {
  return z.coerce.number().int().positive();
}

/**
 * Environment of the API, validated on start — the application does not start without a required key
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_PORT: positiveInt().default(3000),
    APP_VERSION: z.preprocess(emptyToUndefined, z.string().default('dev')),

    LOG_LEVEL: z.enum(LogLevelEnum).default(LogLevelEnum.INFO),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(emptyToUndefined, z.url().optional()),

    DATABASE_URL: z.url(),
    DATABASE_CONNECTION_TIMEOUT_MS: positiveInt().default(5000),

    REDIS_HOST: z.string().min(1),
    REDIS_PORT: positiveInt(),
    BULL_BOARD_PATH: z.string().startsWith('/'),

    LLM_PROVIDER: z.enum(LLMProviderEnum),
    LLM_MODEL_MAIL: z.string().min(1),
    LLM_MODEL_EXTRACT: z.string().min(1),
    LLM_MODEL_NAVIGATION: z.string().min(1),
    LLM_TIMEOUT_MS: positiveInt().default(60000),
    ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    OLLAMA_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    EXTRACT_CONCURRENCY: positiveInt().default(1),

    HEALTH_CHECK_TIMEOUT_MS: positiveInt().default(3000)
  })
  .superRefine((env, context) => {
    if (env.LLM_PROVIDER === LLMProviderEnum.ANTHROPIC && !env.ANTHROPIC_API_KEY) {
      context.addIssue({ code: 'custom', path: ['ANTHROPIC_API_KEY'], message: 'required when LLM_PROVIDER=anthropic' });
    }

    if (env.LLM_PROVIDER === LLMProviderEnum.OLLAMA && !env.OLLAMA_URL) {
      context.addIssue({ code: 'custom', path: ['OLLAMA_URL'], message: 'required when LLM_PROVIDER=ollama' });
    }
  });

/**
 * Validated environment of the API, the type parameter of `ConfigService`
 */
export type IEnv = z.infer<typeof envSchema>;
