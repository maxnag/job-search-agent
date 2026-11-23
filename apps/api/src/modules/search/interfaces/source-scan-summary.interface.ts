import type { SourceScanOutcomeEnum } from '../enums/source-scan-outcome.enum.js';

/**
 * What one scan of a source did — the result of its job
 */
export interface ISourceScanSummary {
  /**
   * Source scanned
   *
   * @var {number}
   */
  readonly sourceId: number;

  /**
   * How the scan ended
   *
   * @var {SourceScanOutcomeEnum}
   */
  readonly outcome: SourceScanOutcomeEnum;

  /**
   * Links on the page
   *
   * @var {number}
   */
  readonly links: number;

  /**
   * Positions the LLM found among them
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
   * Positions dropped by the filter, new and known
   *
   * @var {number}
   */
  readonly skipped: number;

  /**
   * Vacancies gone from the page
   *
   * @var {number}
   */
  readonly closed: number;

  /**
   * Vacancies queued for extraction: new ones and extracted ones due for a recheck
   *
   * @var {number}
   */
  readonly queued: number;
}
