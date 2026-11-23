import { z } from 'zod';

import { LLMProviderEnum, LogLevelEnum } from '@job-agent/shared';

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
 * The key each LLM provider cannot start without. A `Record` over the enum: a new provider without an entry here does
 * not compile, so the start-up check never forgets it
 *
 * @type {Readonly<Record<LLMProviderEnum, 'ANTHROPIC_API_KEY' | 'OLLAMA_URL'>>}
 */
export const LLM_PROVIDER_REQUIRED_KEYS: Readonly<Record<LLMProviderEnum, 'ANTHROPIC_API_KEY' | 'OLLAMA_URL'>> = {
  [LLMProviderEnum.ANTHROPIC]: 'ANTHROPIC_API_KEY',
  [LLMProviderEnum.OLLAMA]: 'OLLAMA_URL'
};

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
    LLM_TIMEOUT_MS: positiveInt().default(60000),
    ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    OLLAMA_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    EXTRACT_CONCURRENCY: positiveInt().default(1),

    HEALTH_CHECK_TIMEOUT_MS: positiveInt().default(3000),

    STORAGE_DIR: z.string().min(1).default('storage')
  })
  .superRefine((env, context) => {
    const key = LLM_PROVIDER_REQUIRED_KEYS[env.LLM_PROVIDER];

    if (!env[key]) {
      context.addIssue({ code: 'custom', path: [key], message: `required when LLM_PROVIDER=${env.LLM_PROVIDER}` });
    }
  });

/**
 * Validated environment of the API, the type parameter of `ConfigService`
 */
export type IEnv = z.infer<typeof envSchema>;
