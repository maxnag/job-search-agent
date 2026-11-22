import { setTimeout as delay } from 'node:timers/promises';

/**
 * Reject after a delay unless the signal aborts first
 *
 * @param {number} timeoutMs
 * @param {AbortSignal} signal
 *
 * @throws {Error} `HEALTH_CHECK_TIMEOUT` when the delay ends
 *
 * @returns {Promise<never>}
 */
async function rejectAfter(timeoutMs: number, signal: AbortSignal): Promise<never> {
  await delay(timeoutMs, undefined, { signal });

  throw new Error(`HEALTH_CHECK_TIMEOUT: no answer in ${timeoutMs} ms`);
}

/**
 * Settle an operation within a time limit
 *
 * @param {() => Promise<T>} operation
 * @param {number} timeoutMs
 *
 * @template T
 *
 * @throws {Error} `HEALTH_CHECK_TIMEOUT` if the operation is slower than the limit
 *
 * @returns {Promise<T>}
 */
export async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();

  try {
    return await Promise.race([operation(), rejectAfter(timeoutMs, controller.signal)]);
  } finally {
    controller.abort();
  }
}
