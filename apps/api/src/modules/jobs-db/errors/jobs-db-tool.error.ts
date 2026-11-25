import type { JobsDBErrorCodeEnum } from '../enums/jobs-db-error-code.enum.js';

/**
 * A call the tool refuses for a reason the client can act on — answered with its code, never logged as a failure
 */
export class JobsDBToolError extends Error {
  /**
   * @param {JobsDBErrorCodeEnum} code
   * @param {string} detail A sentence for the model
   */
  constructor(
    readonly code: JobsDBErrorCodeEnum,
    readonly detail: string
  ) {
    super(`${code}: ${detail}`);
    this.name = JobsDBToolError.name;
  }
}
