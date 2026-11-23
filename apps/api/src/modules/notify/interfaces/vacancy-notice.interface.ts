import type { VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';

/**
 * What a message about a vacancy shows
 */
export interface IVacancyNotice {
  /**
   * The vacancy
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Title
   *
   * @var {string}
   */
  readonly title: string;

  /**
   * Company
   *
   * @var {string}
   */
  readonly company: string;

  /**
   * City
   *
   * @var {string | null}
   */
  readonly city: string | null;

  /**
   * Country code
   *
   * @var {string | null}
   */
  readonly country: string | null;

  /**
   * Work mode
   *
   * @var {WorkModeEnum | null}
   */
  readonly workMode: WorkModeEnum | null;

  /**
   * Page of the vacancy
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Stage
   *
   * @var {VacancyStageEnum}
   */
  readonly stage: VacancyStageEnum;

  /**
   * Verdict against a current resume version, when there is one
   *
   * @var {VacancyMatchVerdictEnum | null}
   */
  readonly verdict: VacancyMatchVerdictEnum | null;

  /**
   * Findings of that verdict
   *
   * @var {readonly IMatchReason[]}
   */
  readonly reasons: readonly IMatchReason[];
}

/**
 * A verdict whose card may be sent
 */
export interface IMatchCard extends IVacancyNotice {
  /**
   * The verdict row
   *
   * @var {number}
   */
  readonly vacancyMatchId: number;

  /**
   * When its card was sent; null — not yet
   *
   * @var {Date | null}
   */
  readonly notifiedAt: Date | null;

  /**
   * True when the verdict is against the current resume version of its profile
   *
   * @var {boolean}
   */
  readonly isCurrentResume: boolean;
}

/**
 * What a message about a stopped source shows
 */
export interface ISourceNotice {
  /**
   * Source name
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Listing page
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Status set by the crawler
   *
   * @var {string}
   */
  readonly status: string;

  /**
   * Why
   *
   * @var {string | null}
   */
  readonly error: string | null;
}
