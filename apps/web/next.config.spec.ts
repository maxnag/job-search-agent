import { afterEach, describe, expect, it, vi } from 'vitest';

import nextConfig from './next.config';

describe('next.config', () => {
  it('sends the bare language to its vacancies, without the browser remembering it', async () => {
    await expect(nextConfig.redirects?.()).resolves.toEqual([
      { source: '/:locale(en|uk)', destination: '/:locale/vacancies', permanent: false }
    ]);
  });

  it('hides the framework from the headers and writes no agent rules', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.agentRules).toBe(false);
    expect(nextConfig.reactStrictMode).toBe(true);
  });

  it('lets the dev server be opened by the machine itself always', () => {
    expect(nextConfig.allowedDevOrigins).toEqual(expect.arrayContaining(['127.0.0.1', 'localhost']));
  });

  describe('with WEB_ALLOWED_DEV_ORIGINS', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('adds the addresses of the variable, trimmed, each once', async () => {
      vi.stubEnv('WEB_ALLOWED_DEV_ORIGINS', ' macbook.local ,localhost,, office.example.test');
      vi.resetModules();

      const { default: config } = await import('./next.config');

      expect(config.allowedDevOrigins).toEqual(['127.0.0.1', 'localhost', 'macbook.local', 'office.example.test']);
    });
  });
});
