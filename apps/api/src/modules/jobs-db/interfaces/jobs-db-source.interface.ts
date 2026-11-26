import type { SourceFetchModeEnum, SourceStatusEnum } from '@job-agent/shared';

/**
 * Which sources to list
 */
export interface IJobsDBSourceFilter {
  /**
   * Only with this status set by the crawler
   *
   * @var {SourceStatusEnum}
   */
  readonly status?: SourceStatusEnum;

  /**
   * The sources the owner switched off too
   *
   * @var {boolean}
   */
  readonly includeInactive?: boolean;
}

/**
 * A source with the number of its open vacancies
 */
export interface IJobsDBSource {
  /**
   * Source id
   *
   * @var {number}
   */
  readonly sourceId: number;

  /**
   * Name
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Listing page, board or mail domain
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Fetch mode
   *
   * @var {SourceFetchModeEnum}
   */
  readonly fetchMode: SourceFetchModeEnum;

  /**
   * Switched on by the owner
   *
   * @var {boolean}
   */
  readonly isActive: boolean;

  /**
   * Status set by the crawler
   *
   * @var {SourceStatusEnum}
   */
  readonly status: SourceStatusEnum;

  /**
   * Last scan
   *
   * @var {Date | null}
   */
  readonly lastScanAt: Date | null;

  /**
   * Last error
   *
   * @var {string | null}
   */
  readonly lastError: string | null;

  /**
   * Vacancies not closed
   *
   * @var {number}
   */
  readonly openVacancies: number;
}
