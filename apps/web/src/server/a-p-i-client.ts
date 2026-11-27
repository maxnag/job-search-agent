import { connection } from 'next/server';
import 'server-only';
import { z } from 'zod';

import type { VacancyActionKindEnum } from '@job-agent/shared';

import { APIClientError } from './a-p-i-client.error';
import { APIErrorCodeEnum } from './a-p-i-error-code.enum';
import { APIHealthStatusEnum } from './a-p-i-health-status.enum';
import { webEnv } from './env';
import { type VacancyActionAnswerType, vacancyActionAnswerSchema } from './schemas/vacancy-action-answer.schema';
import { type VacancyCardType, vacancyCardSchema } from './schemas/vacancy-card.schema';
import { type VacancyFilterOptionsType, vacancyFilterOptionsSchema } from './schemas/vacancy-filter-options.schema';
import { type VacancyListType, vacancyListSchema } from './schemas/vacancy-list.schema';

/**
 * Status code of an answer the API gives when it runs but a dependency (database, Redis, LLM) does not
 *
 * @type {number}
 */
const SERVICE_UNAVAILABLE = 503;

/**
 * The part of the `/health` answer the header needs
 */
const healthSchema = z.object({
  status: z.enum(['ok', 'error'])
});

/**
 * Status code of an answer the API gives for a record it does not have
 *
 * @type {number}
 */
const NOT_FOUND = 404;

/**
 * How to send a request to the API
 */
interface IRequestOptions {
  /**
   * HTTP method; GET unless given
   *
   * @var {'GET' | 'POST'}
   */
  readonly method?: 'GET' | 'POST';

  /**
   * Body, sent as JSON
   *
   * @var {unknown}
   */
  readonly body?: unknown;

  /**
   * Statuses besides 2xx whose body is still an answer
   *
   * @var {readonly number[]}
   */
  readonly acceptedStatuses?: readonly number[];
}

/**
 * Send a request to the API and parse its JSON answer by the schema. Every answer is fresh — nothing is cached
 *
 * @param {string} path
 * @param {z.ZodType<TAnswer>} schema
 * @param {IRequestOptions} [options]
 *
 * @template TAnswer
 *
 * @throws {APIClientError} `API_UNAVAILABLE`, `API_TIMEOUT`, `API_NOT_FOUND`, `API_ERROR` or `API_INVALID_ANSWER`
 *
 * @returns {Promise<TAnswer>}
 */
async function requestJSON<TAnswer>(path: string, schema: z.ZodType<TAnswer>, options: IRequestOptions = {}): Promise<TAnswer> {
  const { method = 'GET', body, acceptedStatuses = [] } = options;
  let response: Response;

  try {
    response = await fetch(new URL(path, webEnv.WEB_API_URL), {
      method,
      cache: 'no-store',
      signal: AbortSignal.timeout(webEnv.WEB_API_TIMEOUT_MS),
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new APIClientError(APIErrorCodeEnum.API_TIMEOUT, `The API did not answer ${path} in time`, error);
    }

    throw new APIClientError(APIErrorCodeEnum.API_UNAVAILABLE, `The API is not reachable for ${path}`, error);
  }

  if (response.status === NOT_FOUND && !acceptedStatuses.includes(NOT_FOUND)) {
    throw new APIClientError(APIErrorCodeEnum.API_NOT_FOUND, `The API has nothing at ${path}`);
  }

  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw new APIClientError(APIErrorCodeEnum.API_ERROR, `The API answered ${path} with ${response.status}`);
  }

  const parsed = schema.safeParse(await response.json().catch(() => undefined));

  if (!parsed.success) {
    throw new APIClientError(APIErrorCodeEnum.API_INVALID_ANSWER, `The API answered ${path} in an unknown shape`, parsed.error);
  }

  return parsed.data;
}

/**
 * State of the API: running, running without a dependency, or not reachable at all. It is read on every request —
 * `connection()` tells Next the component is dynamic before the request is sent, so the catch below never hides that
 * signal from the build
 *
 * @returns {Promise<APIHealthStatusEnum>}
 */
export async function getAPIHealth(): Promise<APIHealthStatusEnum> {
  await connection();

  try {
    const health = await requestJSON('/health', healthSchema, { acceptedStatuses: [SERVICE_UNAVAILABLE] });

    return health.status === 'ok' ? APIHealthStatusEnum.OK : APIHealthStatusEnum.DEGRADED;
  } catch (error) {
    if (error instanceof APIClientError) {
      console.warn({ message: 'API health check failed', code: error.code });

      return APIHealthStatusEnum.DOWN;
    }

    throw error;
  }
}

/**
 * One page of the vacancies the query selects; the query carries the names of the API
 *
 * @param {URLSearchParams} query
 *
 * @throws {APIClientError} If the API fails or answers in an unknown shape
 *
 * @returns {Promise<VacancyListType>}
 */
export async function getVacancies(query: URLSearchParams): Promise<VacancyListType> {
  await connection();

  const search = query.toString();

  return requestJSON(search ? `/api/vacancies?${search}` : '/api/vacancies', vacancyListSchema);
}

/**
 * The values the filters of the list of vacancies offer
 *
 * @throws {APIClientError} If the API fails or answers in an unknown shape
 *
 * @returns {Promise<VacancyFilterOptionsType>}
 */
export async function getVacancyFilterOptions(): Promise<VacancyFilterOptionsType> {
  await connection();

  return requestJSON('/api/vacancies/filters', vacancyFilterOptionsSchema);
}

/**
 * A vacancy with everything known about it; undefined when the API has no such vacancy
 *
 * @param {number} vacancyId
 *
 * @throws {APIClientError} If the API fails or answers in an unknown shape
 *
 * @returns {Promise<VacancyCardType | undefined>}
 */
export async function getVacancy(vacancyId: number): Promise<VacancyCardType | undefined> {
  await connection();

  try {
    return await requestJSON(`/api/vacancies/${vacancyId}`, vacancyCardSchema);
  } catch (error) {
    if (error instanceof APIClientError && error.code === APIErrorCodeEnum.API_NOT_FOUND) {
      return undefined;
    }

    throw error;
  }
}

/**
 * Send the owner's choice about a vacancy to the API
 *
 * @param {number} vacancyId
 * @param {VacancyActionKindEnum} kind
 *
 * @throws {APIClientError} If the API fails, has no such vacancy or answers in an unknown shape
 *
 * @returns {Promise<VacancyActionAnswerType>}
 */
export async function recordVacancyAction(vacancyId: number, kind: VacancyActionKindEnum): Promise<VacancyActionAnswerType> {
  return requestJSON(`/api/vacancies/${vacancyId}/actions`, vacancyActionAnswerSchema, { method: 'POST', body: { kind } });
}
