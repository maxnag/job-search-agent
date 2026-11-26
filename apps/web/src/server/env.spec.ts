import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Import `env.ts` anew with the given variables — it reads `process.env` once, at import
 *
 * @param {Record<string, string | undefined>} variables
 *
 * @returns {Promise<typeof import('./env').webEnv>}
 */
async function loadEnv(variables: Record<string, string | undefined>): Promise<(typeof import('./env'))['webEnv']> {
  vi.resetModules();

  for (const [key, value] of Object.entries(variables)) {
    vi.stubEnv(key, value);
  }

  return (await import('./env')).webEnv;
}

describe('webEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fills the defaults when nothing is set', async () => {
    const env = await loadEnv({ WEB_API_URL: undefined, WEB_API_TIMEOUT_MS: undefined });

    expect(env).toEqual({ WEB_API_URL: 'http://127.0.0.1:3000', WEB_API_TIMEOUT_MS: 5000 });
  });

  it('reads the address and a number from strings', async () => {
    const env = await loadEnv({ WEB_API_URL: 'http://127.0.0.1:3500', WEB_API_TIMEOUT_MS: '2500' });

    expect(env).toEqual({ WEB_API_URL: 'http://127.0.0.1:3500', WEB_API_TIMEOUT_MS: 2500 });
  });

  it.each([
    ['an address that is not a URL', { WEB_API_URL: 'the api' }],
    ['a timeout of zero', { WEB_API_TIMEOUT_MS: '0' }],
    ['a fractional timeout', { WEB_API_TIMEOUT_MS: '1.5' }]
  ])('refuses %s', async (_case, variables) => {
    await expect(loadEnv(variables)).rejects.toThrow();
  });
});
