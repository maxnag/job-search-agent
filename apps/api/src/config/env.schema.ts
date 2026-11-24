import { z } from 'zod';

import { LLMProviderEnum, LogLevelEnum } from '@job-agent/shared';

import { BrowserChannelEnum } from '../modules/crawler/enums/browser-channel.enum.js';

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
 * User-Agent of a regular desktop browser — the crawler presents itself as one
 *
 * @type {string}
 */
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';

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
    JOB_ATTEMPTS: positiveInt().default(3),
    JOB_BACKOFF_MS: positiveInt().default(60000),

    LLM_PROVIDER: z.enum(LLMProviderEnum),
    LLM_TIMEOUT_MS: positiveInt().default(60000),
    ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    OLLAMA_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    EXTRACT_CONCURRENCY: positiveInt().default(1),

    HEALTH_CHECK_TIMEOUT_MS: positiveInt().default(3000),

    STORAGE_DIR: z.string().min(1).default('storage'),

    HTTP_USER_AGENT: z.preprocess(emptyToUndefined, z.string().min(1).default(DEFAULT_USER_AGENT)),
    HTTP_TIMEOUT_MS: positiveInt().default(20000),
    CRAWL_DELAY_MIN_MS: positiveInt().default(3000),
    CRAWL_DELAY_MAX_MS: positiveInt().default(9000),
    CRAWL_API_DELAY_MIN_MS: positiveInt().default(1000),
    CRAWL_API_DELAY_MAX_MS: positiveInt().default(2000),
    ROBOTS_CACHE_TTL_MS: positiveInt().default(86400000),

    RENDER_BROWSER_CHANNEL: z.preprocess(emptyToUndefined, z.enum(BrowserChannelEnum).optional()),
    RENDER_MAX_SCROLLS: positiveInt().default(20),
    RENDER_TIMEOUT_MS: positiveInt().default(60000),
    RENDER_SCROLL_WAIT_MS: positiveInt().default(2500),

    SEARCH_INTERVAL_HOURS: positiveInt().default(3),
    SEARCH_JITTER_MINUTES: z.coerce.number().int().nonnegative().default(30),
    LISTING_MAX_LINKS: positiveInt().default(500),
    LISTING_BATCH_SIZE: positiveInt().default(100),
    VACANCY_RECHECK_HOURS: positiveInt().default(24),
    VACANCY_TEXT_MAX_CHARS: positiveInt().default(30000),

    TELEGRAM_BOT_TOKEN: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^\d+:[\w-]+$/, 'expected <bot id>:<secret> from @BotFather')
        .optional()
    ),
    TELEGRAM_CHAT_ID: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^-?\d+$/)
        .optional()
    ),
    NOTIFY_SWEEP_MINUTES: positiveInt().default(5),

    BRAVE_SEARCH_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    DISCOVER_MAX_QUERIES: positiveInt().default(40),
    DISCOVER_CRON: z.preprocess(emptyToUndefined, z.string().min(1).default('0 9 * * 1')),
    DISCOVER_RECHECK_DAYS: positiveInt().default(30),
    DISCOVER_BOARD_TIMEOUT_MS: positiveInt().default(10000),
    DISCOVER_MAX_CARDS: positiveInt().default(10)
  })
  .superRefine((env, context) => {
    const key = LLM_PROVIDER_REQUIRED_KEYS[env.LLM_PROVIDER];

    if (!env[key]) {
      context.addIssue({ code: 'custom', path: [key], message: `required when LLM_PROVIDER=${env.LLM_PROVIDER}` });
    }

    if (Boolean(env.TELEGRAM_BOT_TOKEN) !== Boolean(env.TELEGRAM_CHAT_ID)) {
      context.addIssue({ code: 'custom', path: ['TELEGRAM_CHAT_ID'], message: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID go together' });
    }

    if (env.CRAWL_DELAY_MIN_MS > env.CRAWL_DELAY_MAX_MS) {
      context.addIssue({ code: 'custom', path: ['CRAWL_DELAY_MAX_MS'], message: 'must not be less than CRAWL_DELAY_MIN_MS' });
    }

    if (env.CRAWL_API_DELAY_MIN_MS > env.CRAWL_API_DELAY_MAX_MS) {
      context.addIssue({ code: 'custom', path: ['CRAWL_API_DELAY_MAX_MS'], message: 'must not be less than CRAWL_API_DELAY_MIN_MS' });
    }
  });

/**
 * Validated environment of the API, the type parameter of `ConfigService`
 */
export type IEnv = z.infer<typeof envSchema>;
