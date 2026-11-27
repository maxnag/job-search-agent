import { headers } from 'next/headers';
import { describe, expect, it, vi } from 'vitest';

import { isPhone } from './device';

vi.mock('next/headers', () => ({ headers: vi.fn() }));

describe('isPhone', () => {
  it.each([
    ['an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', true],
    ['an Android phone', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36', true],
    ['an Android tablet', 'Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 Chrome/131.0 Safari/537.36', false],
    [
      'a Mac — an iPad in Safari says the same',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      false
    ],
    ['no user agent', undefined, false]
  ])('tells %s', async (_case, agent, expected) => {
    vi.mocked(headers).mockResolvedValue(new Headers(agent === undefined ? {} : { 'user-agent': agent }));

    await expect(isPhone()).resolves.toBe(expected);
  });
});
