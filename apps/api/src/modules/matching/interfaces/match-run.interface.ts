import type { VacancyMatchVerdictEnum } from '@job-agent/shared';

/**
 * What a run of the matching code stored
 */
export interface IMatchRun {
  /**
   * Verdicts stored, by verdict
   *
   * @var {Readonly<Record<VacancyMatchVerdictEnum, number>>}
   */
  readonly verdicts: Readonly<Record<VacancyMatchVerdictEnum, number>>;

  /**
   * `fit` and `almost` verdicts of vacancies the profile never got a card for — the owner is to be told
   *
   * @var {readonly number[]}
   */
  readonly notifiableMatchIds: readonly number[];

  /**
   * Vacancies whose data could not be read, left unmatched
   *
   * @var {number}
   */
  readonly unreadable: number;
}
