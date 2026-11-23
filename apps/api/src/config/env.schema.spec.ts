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

describe('LLM_PROVIDER_REQUIRED_KEYS', () => {
  it('names a required key for every provider', () => {
    const byName = (first: string, second: string): number => first.localeCompare(second);

    expect(Object.keys(LLM_PROVIDER_REQUIRED_KEYS).sort(byName)).toEqual(Object.values(LLMProviderEnum).sort(byName));
  });
});
