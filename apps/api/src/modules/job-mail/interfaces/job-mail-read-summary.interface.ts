/**
 * What one reading of the mailbox did
 */
export interface IJobMailReadSummary {
  /**
   * Start of the window: e-mails received earlier are not read
   *
   * @var {Date}
   */
  readonly since: Date;

  /**
   * E-mails in the window
   *
   * @var {number}
   */
  readonly mails: number;

  /**
   * E-mails not read before
   *
   * @var {number}
   */
  readonly fresh: number;

  /**
   * Job alerts among the new e-mails whose links were read
   *
   * @var {number}
   */
  readonly alerts: number;

  /**
   * Job alerts that failed for good
   *
   * @var {number}
   */
  readonly failed: number;

  /**
   * Positions the LLM picked in the job alerts
   *
   * @var {number}
   */
  readonly positions: number;

  /**
   * New vacancies
   *
   * @var {number}
   */
  readonly created: number;

  /**
   * Vacancies queued for extraction, the ones whose description is looked up again included
   *
   * @var {number}
   */
  readonly queued: number;
}
