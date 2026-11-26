import type { VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * Which positions the report shows: every condition given must hold, the values of one condition are alternatives
 */
export interface IVacancyReportFilter {
  /**
   * Positions of these sources
   *
   * @var {readonly number[]}
   */
  readonly sourceIds?: readonly number[];

  /**
   * At one of these stages
   *
   * @var {readonly VacancyStageEnum[]}
   */
  readonly stages?: readonly VacancyStageEnum[];

  /**
   * With one of these verdicts against the current resume of any profile
   *
   * @var {readonly VacancyMatchVerdictEnum[]}
   */
  readonly verdicts?: readonly VacancyMatchVerdictEnum[];

  /**
   * Text the skip reason or a finding of a verdict contains, case aside
   *
   * @var {string}
   */
  readonly reason?: string;

  /**
   * Country code
   *
   * @var {string}
   */
  readonly country?: string;

  /**
   * Work mode
   *
   * @var {WorkModeEnum}
   */
  readonly workMode?: WorkModeEnum;

  /**
   * Text the title contains, case aside
   *
   * @var {string}
   */
  readonly title?: string;

  /**
   * Text the company contains, case aside
   *
   * @var {string}
   */
  readonly company?: string;

  /**
   * First seen within this many days
   *
   * @var {number}
   */
  readonly sinceDays?: number;

  /**
   * At most this many newest positions per source
   *
   * @var {number}
   */
  readonly limit?: number;

  /**
   * Show the closed positions too — they are hidden unless asked for, here or by their stage
   *
   * @var {boolean}
   */
  readonly closed?: boolean;
}
