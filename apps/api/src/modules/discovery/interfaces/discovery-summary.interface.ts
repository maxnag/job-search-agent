import type { ATSKindEnum, SourceCandidateStatusEnum } from '@job-agent/shared';

/**
 * A board the discovery read
 */
export interface IDiscoveredBoard {
  /**
   * The applicant tracking system
   *
   * @var {ATSKindEnum}
   */
  readonly kind: ATSKindEnum;

  /**
   * The board within it
   *
   * @var {string}
   */
  readonly board: string;

  /**
   * Company name — from the board, else the board name
   *
   * @var {string}
   */
  readonly company: string;

  /**
   * Published positions
   *
   * @var {number}
   */
  readonly positions: number;

  /**
   * Positions some profile wants by company and place
   *
   * @var {number}
   */
  readonly matching: number;

  /**
   * Positions whose country, or work mode where it matters, is not known — never counted as wanted
   *
   * @var {number}
   */
  readonly unknown: number;

  /**
   * `proposed` with matching positions, `empty` without
   *
   * @var {SourceCandidateStatusEnum}
   */
  readonly status: SourceCandidateStatusEnum;

  /**
   * Id of the stored candidate; absent on a dry run
   *
   * @var {number | undefined}
   */
  readonly candidateId?: number;
}

/**
 * What one discovery run did
 */
export interface IDiscoverySummary {
  /**
   * Web search queries sent
   *
   * @var {number}
   */
  readonly queries: number;

  /**
   * Distinct boards among the results
   *
   * @var {number}
   */
  readonly boards: number;

  /**
   * Boards already a source or a candidate not due for a check
   *
   * @var {number}
   */
  readonly known: number;

  /**
   * Boards that could not be read
   *
   * @var {number}
   */
  readonly failed: number;

  /**
   * Candidate cards queued for the owner
   *
   * @var {number}
   */
  readonly cards: number;

  /**
   * Boards read this run
   *
   * @var {readonly IDiscoveredBoard[]}
   */
  readonly discovered: readonly IDiscoveredBoard[];
}
