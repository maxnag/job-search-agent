import type { VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

/**
 * How many vacancies are at a stage
 */
export interface IJobsDBStageCount {
  /**
   * Stage
   *
   * @var {VacancyStageEnum}
   */
  readonly stage: VacancyStageEnum;

  /**
   * Vacancies
   *
   * @var {number}
   */
  readonly count: number;
}

/**
 * How many vacancies got a verdict against the current resume of a profile
 */
export interface IJobsDBVerdictCount {
  /**
   * Profile
   *
   * @var {string}
   */
  readonly profileName: string;

  /**
   * Verdict
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly verdict: VacancyMatchVerdictEnum;

  /**
   * Vacancies
   *
   * @var {number}
   */
  readonly count: number;
}

/**
 * How many vacancies a source brought
 */
export interface IJobsDBSourceCount {
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
   * Vacancies
   *
   * @var {number}
   */
  readonly count: number;
}

/**
 * How many choices of a kind the owner made
 */
export interface IJobsDBActionCount {
  /**
   * Choice
   *
   * @var {VacancyActionKindEnum}
   */
  readonly kind: VacancyActionKindEnum;

  /**
   * Choices
   *
   * @var {number}
   */
  readonly count: number;
}

/**
 * The counters of the pipeline over the vacancies first seen in a period, or over all of them
 */
export interface IJobsDBPipelineCounts {
  /**
   * By stage
   *
   * @var {readonly IJobsDBStageCount[]}
   */
  readonly byStage: readonly IJobsDBStageCount[];

  /**
   * By verdict against the current resumes
   *
   * @var {readonly IJobsDBVerdictCount[]}
   */
  readonly byVerdict: readonly IJobsDBVerdictCount[];

  /**
   * By source
   *
   * @var {readonly IJobsDBSourceCount[]}
   */
  readonly bySource: readonly IJobsDBSourceCount[];

  /**
   * Choices of the owner made in the period
   *
   * @var {readonly IJobsDBActionCount[]}
   */
  readonly actions: readonly IJobsDBActionCount[];

  /**
   * Cards sent in the period
   *
   * @var {number}
   */
  readonly cardsSent: number;
}
