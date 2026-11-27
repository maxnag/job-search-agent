import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VacancyActionKindEnum } from '@job-agent/shared';

import { getAPIHealth, getVacancies, getVacancy, getVacancyFilterOptions, recordVacancyAction } from './a-p-i-client';
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

describe('the vacancies of the API', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const PAGE = { total: 0, page: 1, pageSize: 25, vacancies: [] };
  const CARD = {
    vacancyId: 7,
    title: 'Backend Developer',
    company: 'Northwind',
    city: null,
    country: 'IL',
    workMode: null,
    level: null,
    stage: 'extracted',
    skipReason: null,
    source: 'Northwind',
    url: 'https://careers.example.com/jobs/7',
    textURL: null,
    firstSeenAt: '2026-11-20T10:00:00.000Z',
    lastSeenAt: '2026-11-20T10:00:00.000Z',
    closedAt: null,
    extraction: null,
    matches: [],
    actions: []
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('asks for a page of the list with the query as given', async () => {
    fetchMock.mockResolvedValue(answer(200, PAGE));

    await expect(getVacancies(new URLSearchParams('country=IL&country=UA&page=2'))).resolves.toEqual(PAGE);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://127.0.0.1:3000/api/vacancies?country=IL&country=UA&page=2'));
  });

  it('asks for the list without a query when there is none', async () => {
    fetchMock.mockResolvedValue(answer(200, PAGE));

    await getVacancies(new URLSearchParams());

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://127.0.0.1:3000/api/vacancies'));
  });

  it('refuses a page of an unknown shape', async () => {
    fetchMock.mockResolvedValue(answer(200, { total: 'many' }));

    await expect(getVacancies(new URLSearchParams())).rejects.toMatchObject({ code: APIErrorCodeEnum.API_INVALID_ANSWER });
  });

  it('asks for the values of the filters', async () => {
    const options = { sources: [{ sourceId: 3, name: 'Northwind' }], countries: ['IL'], cities: [{ country: 'IL', city: 'Haifa' }] };

    fetchMock.mockResolvedValue(answer(200, options));

    await expect(getVacancyFilterOptions()).resolves.toEqual(options);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://127.0.0.1:3000/api/vacancies/filters'));
  });

  it('reads a card', async () => {
    fetchMock.mockResolvedValue(answer(200, CARD));

    await expect(getVacancy(7)).resolves.toEqual(CARD);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://127.0.0.1:3000/api/vacancies/7'));
  });

  it('gives no card for a vacancy the API does not have', async () => {
    fetchMock.mockResolvedValue(answer(404, { code: 'VACANCY_NOT_FOUND' }));

    await expect(getVacancy(7)).resolves.toBeUndefined();
  });

  it('passes another failure of a card on', async () => {
    fetchMock.mockResolvedValue(answer(500, {}));

    await expect(getVacancy(7)).rejects.toMatchObject({ code: APIErrorCodeEnum.API_ERROR });
  });

  it('posts a choice as JSON', async () => {
    fetchMock.mockResolvedValue(answer(200, { kind: 'applied', recorded: true }));

    await expect(recordVacancyAction(7, VacancyActionKindEnum.APPLIED)).resolves.toEqual({ kind: 'applied', recorded: true });

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toEqual(new URL('http://127.0.0.1:3000/api/vacancies/7/actions'));
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ kind: 'applied' }));
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });

  it('answers API_NOT_FOUND for a choice about a vacancy the API does not have', async () => {
    fetchMock.mockResolvedValue(answer(404, {}));

    await expect(recordVacancyAction(7, VacancyActionKindEnum.APPLIED)).rejects.toMatchObject({ code: APIErrorCodeEnum.API_NOT_FOUND });
  });
});
