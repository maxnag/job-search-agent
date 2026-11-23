import type { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IMatchReason } from './match-reason.interface.js';

/**
 * A verdict to store for a vacancy against a resume version
 */
export interface IVacancyMatchWrite {
  /**
   * The vacancy
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * The resume version
   *
   * @var {number}
   */
  readonly resumeId: number;

  /**
   * Verdict
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly verdict: VacancyMatchVerdictEnum;

  /**
   * Findings
   *
   * @var {readonly IMatchReason[]}
   */
  readonly reasons: readonly IMatchReason[];
}

/**
 * A stored verdict and whether its card was sent
 */
export interface IStoredVacancyMatch {
  /**
   * Row id
   *
   * @var {number}
   */
  readonly vacancyMatchId: number;

  /**
   * Verdict
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly verdict: VacancyMatchVerdictEnum;

  /**
   * When the card was sent; null — not yet
   *
   * @var {Date | null}
   */
  readonly notifiedAt: Date | null;
}
