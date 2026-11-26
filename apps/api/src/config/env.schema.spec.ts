import { describe, expect, it } from 'vitest';

import { LLMProviderEnum } from '@job-agent/shared';

import { LLM_PROVIDER_REQUIRED_KEYS, envSchema } from './env.schema.js';

const BASE = {
  DATABASE_URL: 'postgres://user:password@localhost:5433/db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6380',
  BULL_BOARD_PATH: '/queues',
  LLM_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: 'test-key'
};

const issues = (env: Record<string, string>): string[] => {
  const result = envSchema.safeParse(env);

  return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'));
};

describe('envSchema', () => {
  it('accepts a complete environment and fills the defaults', () => {
    const env = envSchema.parse(BASE);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      APP_HOST: '127.0.0.1',
      APP_PORT: 3000,
      APP_VERSION: 'dev',
      LLM_TIMEOUT_MS: 60000,
      STORAGE_DIR: 'storage'
    });
  });

  it('reads numbers from strings', () => {
    expect(envSchema.parse({ ...BASE, APP_PORT: '3500' }).APP_PORT).toBe(3500);
  });

  it('treats an empty value as a missing one', () => {
    expect(envSchema.parse({ ...BASE, APP_VERSION: '' }).APP_VERSION).toBe('dev');
  });

  it('listens only on this machine unless told otherwise', () => {
    expect(envSchema.parse(BASE).APP_HOST).toBe('127.0.0.1');
    expect(envSchema.parse({ ...BASE, APP_HOST: '0.0.0.0' }).APP_HOST).toBe('0.0.0.0');
  });

  it('refuses an empty address instead of guessing one', () => {
    expect(issues({ ...BASE, APP_HOST: '' })).toEqual(['APP_HOST']);
  });

  it.each([
    [LLMProviderEnum.ANTHROPIC, { ANTHROPIC_API_KEY: '' }, 'ANTHROPIC_API_KEY'],
    [LLMProviderEnum.OLLAMA, { ANTHROPIC_API_KEY: '' }, 'OLLAMA_URL']
  ])('requires the key of the provider %s', (provider, overrides, key) => {
    expect(issues({ ...BASE, ...overrides, LLM_PROVIDER: provider })).toEqual([key]);
  });

  it('does not require the key of a provider not in use', () => {
    expect(issues({ ...BASE, LLM_PROVIDER: 'ollama', OLLAMA_URL: 'http://localhost:11434', ANTHROPIC_API_KEY: '' })).toEqual([]);
  });

  it.each(['DATABASE_URL', 'REDIS_HOST', 'BULL_BOARD_PATH'])('names the missing required key %s', key => {
    const env: Record<string, string> = { ...BASE };

    delete env[key];

    expect(issues(env)).toContain(key);
  });

  it('rejects an unknown provider', () => {
    expect(issues({ ...BASE, LLM_PROVIDER: 'openai' })).toContain('LLM_PROVIDER');
  });

  it('rejects a Bull Board path without a leading slash', () => {
    expect(issues({ ...BASE, BULL_BOARD_PATH: 'queues' })).toContain('BULL_BOARD_PATH');
  });
});

describe('envSchema — crawling and Telegram', () => {
  it('fills the defaults of the crawler, the search and the sweep', () => {
    expect(envSchema.parse(BASE)).toMatchObject({
      CRAWL_DELAY_MIN_MS: 3000,
      CRAWL_DELAY_MAX_MS: 9000,
      SEARCH_INTERVAL_HOURS: expect.any(Number) as number,
      NOTIFY_SWEEP_MINUTES: expect.any(Number) as number
    });
    expect(envSchema.parse(BASE).RENDER_BROWSER_CHANNEL).toBeUndefined();
  });

  it('accepts equal crawl pauses and refuses a lower bound above the upper one', () => {
    expect(issues({ ...BASE, CRAWL_DELAY_MIN_MS: '5000', CRAWL_DELAY_MAX_MS: '5000' })).toEqual([]);
    expect(issues({ ...BASE, CRAWL_DELAY_MIN_MS: '5001', CRAWL_DELAY_MAX_MS: '5000' })).toEqual(['CRAWL_DELAY_MAX_MS']);
  });

  it('accepts a system browser channel and refuses an unknown one', () => {
    expect(envSchema.parse({ ...BASE, RENDER_BROWSER_CHANNEL: 'chrome' }).RENDER_BROWSER_CHANNEL).toBe('chrome');
    expect(issues({ ...BASE, RENDER_BROWSER_CHANNEL: 'chrom' })).toEqual(['RENDER_BROWSER_CHANNEL']);
  });

  it('accepts a bot token with a chat id, a channel id included', () => {
    expect(issues({ ...BASE, TELEGRAM_BOT_TOKEN: '123456789:AAF-fictional_secret', TELEGRAM_CHAT_ID: '-1001234567890' })).toEqual([]);
    expect(issues({ ...BASE, TELEGRAM_BOT_TOKEN: '123456789:AAF-fictional_secret', TELEGRAM_CHAT_ID: '42' })).toEqual([]);
  });

  it('accepts neither of them — Telegram switched off', () => {
    expect(issues({ ...BASE, TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' })).toEqual([]);
  });

  it.each([
    ['a token without a chat id', { TELEGRAM_BOT_TOKEN: '123456789:AAF-fictional_secret' }],
    ['a chat id without a token', { TELEGRAM_CHAT_ID: '42' }]
  ])('refuses %s', (_case, telegram: Record<string, string>) => {
    expect(issues({ ...BASE, ...telegram })).toEqual(['TELEGRAM_CHAT_ID']);
  });

  it.each(['AAF-fictional_secret', 'bot123:abc', '123456789 AAF'])('refuses the bot token %j, which @BotFather never gives', token => {
    expect(issues({ ...BASE, TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: '42' })).toContain('TELEGRAM_BOT_TOKEN');
  });

  it.each(['@channel', '12a', '--1'])('refuses the chat id %j', chatId => {
    expect(issues({ ...BASE, TELEGRAM_BOT_TOKEN: '123456789:AAF-fictional_secret', TELEGRAM_CHAT_ID: chatId })).toContain(
      'TELEGRAM_CHAT_ID'
    );
  });
});

describe('LLM_PROVIDER_REQUIRED_KEYS', () => {
  it('names a required key for every provider', () => {
    const byName = (first: string, second: string): number => first.localeCompare(second);

    expect(Object.keys(LLM_PROVIDER_REQUIRED_KEYS).sort(byName)).toEqual(Object.values(LLMProviderEnum).sort(byName));
  });
});
