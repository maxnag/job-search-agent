import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withTimeout } from './with-timeout.helper.js';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result of an operation faster than the limit', async () => {
    await expect(withTimeout(() => Promise.resolve('pong'), 1000)).resolves.toBe('pong');
  });

  it('rejects an operation slower than the limit', async () => {
    const caught = withTimeout(() => new Promise<never>(() => undefined), 1000).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(1000);

    expect(await caught).toEqual(new Error('HEALTH_CHECK_TIMEOUT: no answer in 1000 ms'));
  });

  it('passes on the error of a failing operation', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('ECONNREFUSED')), 1000)).rejects.toThrow('ECONNREFUSED');
  });

  it('leaves no timer behind once the operation settles', async () => {
    await withTimeout(() => Promise.resolve('pong'), 1000);

    expect(vi.getTimerCount()).toBe(0);
  });
});
