import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';
import { braveSearchSchema } from '../schemas/brave-search.schema.js';

/**
 * Web Search endpoint of the Brave Search API
 *
 * @type {string}
 */
const SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Results asked for per query — the most the API gives on one page
 *
 * @type {number}
 */
const RESULTS_PER_QUERY = 20;

/**
 * Answers that mean the key is wrong or out of credit — no later query can succeed
 *
 * @type {ReadonlySet<number>}
 */
const UNAUTHORIZED_STATUSES: ReadonlySet<number> = new Set([401, 402, 403]);

/**
 * Status of a rate-limited request
 *
 * @type {number}
 */
const TOO_MANY_REQUESTS = 429;

/**
 * Brave Search API client of the discovery. The answer is used transiently: only the result URLs leave this class, and
 * nothing of the answer is stored or logged (terms of the API). The key goes in a header only
 */
@Injectable()
export class BraveSearchClient {
  /**
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(private readonly configService: ConfigService<IEnv, true>) {}

  /**
   * True when a key is configured
   *
   * @returns {boolean}
   */
  isEnabled(): boolean {
    return !!this.configService.get('BRAVE_SEARCH_API_KEY', { infer: true });
  }

  /**
   * The URLs of the first page of results of a query
   *
   * @param {string} query
   *
   * @throws {Error} `BRAVE_SEARCH_DISABLED` if no key is configured
   * @throws {Error} `BRAVE_SEARCH_UNAUTHORIZED` if the key is refused or out of credit
   * @throws {Error} `BRAVE_SEARCH_RATE_LIMITED` on 429
   * @throws {Error} `BRAVE_SEARCH_FAILED` on another failed answer, a timeout or an answer of an unknown shape
   *
   * @returns {Promise<string[]>}
   */
  async search(query: string): Promise<string[]> {
    const key = this.configService.get('BRAVE_SEARCH_API_KEY', { infer: true });

    if (!key) {
      throw new Error('BRAVE_SEARCH_DISABLED: BRAVE_SEARCH_API_KEY is not set');
    }

    const url = new URL(SEARCH_URL);

    url.searchParams.set('q', query);
    url.searchParams.set('count', `${RESULTS_PER_QUERY}`);

    const response = await this.request(url, key);

    if (UNAUTHORIZED_STATUSES.has(response.status)) {
      throw new Error(`BRAVE_SEARCH_UNAUTHORIZED: HTTP ${response.status}`);
    }

    if (response.status === TOO_MANY_REQUESTS) {
      throw new Error('BRAVE_SEARCH_RATE_LIMITED: HTTP 429');
    }

    if (!response.ok) {
      throw new Error(`BRAVE_SEARCH_FAILED: HTTP ${response.status}`);
    }

    const answer = braveSearchSchema.safeParse(await response.json());

    if (!answer.success) {
      throw new Error('BRAVE_SEARCH_FAILED: the answer does not match the schema', { cause: answer.error });
    }

    return (answer.data.web?.results ?? []).map(result => result.url);
  }

  /**
   * Send the request within the HTTP timeout
   *
   * @param {URL} url
   * @param {string} key
   *
   * @throws {Error} `BRAVE_SEARCH_FAILED` on a timeout or a network failure
   *
   * @returns {Promise<Response>}
   */
  private async request(url: URL, key: string): Promise<Response> {
    try {
      return await fetch(url, {
        headers: { accept: 'application/json', 'x-subscription-token': key },
        signal: AbortSignal.timeout(this.configService.get('HTTP_TIMEOUT_MS', { infer: true }))
      });
    } catch (error) {
      throw new Error(`BRAVE_SEARCH_FAILED: ${(error as Error).message}`, { cause: error });
    }
  }
}
