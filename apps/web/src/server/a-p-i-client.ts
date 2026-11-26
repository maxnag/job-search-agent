import { connection } from 'next/server';
import 'server-only';
import { z } from 'zod';

import { APIClientError } from './a-p-i-client.error';
import { APIErrorCodeEnum } from './a-p-i-error-code.enum';
import { APIHealthStatusEnum } from './a-p-i-health-status.enum';
import { webEnv } from './env';

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
 * Send a GET request to the API and parse its JSON answer by the schema. Every answer is fresh — nothing is cached
 *
 * @param {string} path
 * @param {z.ZodType<TAnswer>} schema
 * @param {readonly number[]} [acceptedStatuses] statuses besides 2xx whose body is still an answer
 *
 * @template TAnswer
 *
 * @throws {APIClientError} `API_UNAVAILABLE`, `API_TIMEOUT`, `API_ERROR` or `API_INVALID_ANSWER`
 *
 * @returns {Promise<TAnswer>}
 */
async function getJSON<TAnswer>(path: string, schema: z.ZodType<TAnswer>, acceptedStatuses: readonly number[] = []): Promise<TAnswer> {
  let response: Response;

  try {
    response = await fetch(new URL(path, webEnv.WEB_API_URL), {
      cache: 'no-store',
      signal: AbortSignal.timeout(webEnv.WEB_API_TIMEOUT_MS)
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new APIClientError(APIErrorCodeEnum.API_TIMEOUT, `The API did not answer ${path} in time`, error);
    }

    throw new APIClientError(APIErrorCodeEnum.API_UNAVAILABLE, `The API is not reachable for ${path}`, error);
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
    const health = await getJSON('/health', healthSchema, [SERVICE_UNAVAILABLE]);

    return health.status === 'ok' ? APIHealthStatusEnum.OK : APIHealthStatusEnum.DEGRADED;
  } catch (error) {
    if (error instanceof APIClientError) {
      console.warn({ message: 'API health check failed', code: error.code });

      return APIHealthStatusEnum.DOWN;
    }

    throw error;
  }
}
