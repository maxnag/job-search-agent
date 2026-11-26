import { describe, expect, it } from 'vitest';

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
});
