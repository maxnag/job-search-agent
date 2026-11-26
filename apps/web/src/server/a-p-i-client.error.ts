import 'server-only';

import type { APIErrorCodeEnum } from './a-p-i-error-code.enum';

/**
 * A request of the web server to the API failed; the code says why, the cause keeps the original error
 */
export class APIClientError extends Error {
  /**
   * @param {APIErrorCodeEnum} code
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(
    readonly code: APIErrorCodeEnum,
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = APIClientError.name;
  }
}
