import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { BraveSearchClient } from './brave-search.client.js';

/**
 * A JSON answer of the search API
 *
 * @param {number} status
 * @param {unknown} body
 *
 * @returns {Response}
 */
function answer(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * The client with a key or without one
 *
 * @param {string | undefined} key
 *
 * @returns {Promise<{ moduleFixture: TestingModule; client: BraveSearchClient }>}
 */
async function setUp(key: string | undefined): Promise<{ moduleFixture: TestingModule; client: BraveSearchClient }> {
  const moduleFixture = await Test.createTestingModule({
    providers: [
      BraveSearchClient,
      { provide: ConfigService, useValue: createConfigMock({ BRAVE_SEARCH_API_KEY: key, HTTP_TIMEOUT_MS: 5000 }) }
    ]
  }).compile();

  return { moduleFixture, client: moduleFixture.get(BraveSearchClient) };
}

describe('BraveSearchClient (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: BraveSearchClient;

  beforeEach(async () => {
    ({ moduleFixture, client: subjectUnderTest } = await setUp('test-key'));
  });

  afterEach(async () => {
    await moduleFixture.close();
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('isEnabled', () => {
    it('is enabled with a key', () => {
      expect(subjectUnderTest.isEnabled()).toBe(true);
    });

    it.each([undefined, ''])('is disabled with the key %j', async key => {
      const { moduleFixture: other, client } = await setUp(key);

      expect(client.isEnabled()).toBe(false);
      await other.close();
    });
  });

  describe('search', () => {
    it('sends the query with the key and returns only the result URLs', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        answer(200, {
          web: {
            results: [
              { url: 'https://jobs.lever.co/Contoso/1', title: 'Backend Engineer', description: 'snippet' },
              { url: 'https://job-boards.greenhouse.io/northwind/jobs/2' }
            ]
          }
        })
      );

      const urls = await subjectUnderTest.search('site:jobs.lever.co Israel "backend"');

      expect(urls).toEqual(['https://jobs.lever.co/Contoso/1', 'https://job-boards.greenhouse.io/northwind/jobs/2']);

      const [url, init] = fetchSpy.mock.calls[0] ?? [];

      expect((url as URL).searchParams.get('q')).toBe('site:jobs.lever.co Israel "backend"');
      expect((url as URL).searchParams.get('count')).toBe('20');
      expect(init?.headers).toEqual({ accept: 'application/json', 'x-subscription-token': 'test-key' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('gives no URLs when the answer has no web results', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(answer(200, { query: {} }));

      expect(await subjectUnderTest.search('q')).toEqual([]);
    });

    it('throws BRAVE_SEARCH_DISABLED without a key and sends nothing', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const { moduleFixture: other, client } = await setUp(undefined);

      await expect(client.search('q')).rejects.toThrow('BRAVE_SEARCH_DISABLED');
      expect(fetchSpy).not.toHaveBeenCalled();
      await other.close();
    });

    it.each([401, 402, 403])('throws BRAVE_SEARCH_UNAUTHORIZED on HTTP %i', async status => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(answer(status));

      await expect(subjectUnderTest.search('q')).rejects.toThrow(`BRAVE_SEARCH_UNAUTHORIZED: HTTP ${status}`);
    });

    it('throws BRAVE_SEARCH_RATE_LIMITED on HTTP 429', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(answer(429));

      await expect(subjectUnderTest.search('q')).rejects.toThrow('BRAVE_SEARCH_RATE_LIMITED');
    });

    it('throws BRAVE_SEARCH_FAILED on another HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(answer(500));

      await expect(subjectUnderTest.search('q')).rejects.toThrow('BRAVE_SEARCH_FAILED: HTTP 500');
    });

    it('throws BRAVE_SEARCH_FAILED for an answer of another shape', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(answer(200, { web: { results: [{ title: 'no url' }] } }));

      await expect(subjectUnderTest.search('q')).rejects.toThrow('BRAVE_SEARCH_FAILED: the answer does not match the schema');
    });

    it('throws BRAVE_SEARCH_FAILED when the request fails, keeping the cause', async () => {
      const failure = new Error('socket hang up');

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(failure);

      const error = await subjectUnderTest.search('q').catch((caught: unknown) => caught);

      expect((error as Error).message).toBe('BRAVE_SEARCH_FAILED: socket hang up');
      expect((error as Error).cause).toBe(failure);
    });
  });
});
