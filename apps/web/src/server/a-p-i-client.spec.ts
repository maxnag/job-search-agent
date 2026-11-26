import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAPIHealth } from './a-p-i-client';
import { APIErrorCodeEnum } from './a-p-i-error-code.enum';
import { APIHealthStatusEnum } from './a-p-i-health-status.enum';

vi.mock('next/server', () => ({ connection: vi.fn(async () => Promise.resolve()) }));

/**
 * An answer of `fetch` with a JSON body
 *
 * @param {number} status
 * @param {unknown} body
 *
 * @returns {Response}
 */
function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('getAPIHealth', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('asks /health of the configured API, never from the cache, with a time limit', async () => {
    fetchMock.mockResolvedValue(answer(200, { status: 'ok' }));

    await getAPIHealth();

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toEqual(new URL('http://127.0.0.1:3000/health'));
    expect(init?.cache).toBe('no-store');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('is OK when the API answers ok', async () => {
    fetchMock.mockResolvedValue(answer(200, { status: 'ok', checks: { postgres: 'up' } }));

    await expect(getAPIHealth()).resolves.toBe(APIHealthStatusEnum.OK);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('is DEGRADED when the API answers 503 — it runs, a dependency does not', async () => {
    fetchMock.mockResolvedValue(answer(503, { status: 'error' }));

    await expect(getAPIHealth()).resolves.toBe(APIHealthStatusEnum.DEGRADED);
  });

  it.each([
    ['not reachable', new TypeError('fetch failed'), APIErrorCodeEnum.API_UNAVAILABLE],
    ['too slow', new DOMException('The operation timed out', 'TimeoutError'), APIErrorCodeEnum.API_TIMEOUT]
  ])('is DOWN when the API is %s, and warns with the code only', async (_case, error, code) => {
    fetchMock.mockRejectedValue(error);

    await expect(getAPIHealth()).resolves.toBe(APIHealthStatusEnum.DOWN);
    expect(warnSpy).toHaveBeenCalledWith({ message: 'API health check failed', code });
  });

  it('is DOWN when the API answers another error status', async () => {
    fetchMock.mockResolvedValue(answer(500, { status: 'error' }));

    await expect(getAPIHealth()).resolves.toBe(APIHealthStatusEnum.DOWN);
    expect(warnSpy).toHaveBeenCalledWith({ message: 'API health check failed', code: APIErrorCodeEnum.API_ERROR });
  });

  it.each([
    ['an unknown status', { status: 'maybe' }],
    ['no status', {}]
  ])('is DOWN when the answer has %s', async (_case, body) => {
    fetchMock.mockResolvedValue(answer(200, body));

    await expect(getAPIHealth()).resolves.toBe(APIHealthStatusEnum.DOWN);
    expect(warnSpy).toHaveBeenCalledWith({
      message: 'API health check failed',
      code: APIErrorCodeEnum.API_INVALID_ANSWER
    });
  });

  it('is DOWN when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200 }));

    await expect(getAPIHealth()).resolves.toBe(APIHealthStatusEnum.DOWN);
  });

  it('does not swallow an error that is not about the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => {
        throw new RangeError('broken runtime');
      }
    } as unknown as Response);

    await expect(getAPIHealth()).rejects.toThrow(RangeError);
  });
});
