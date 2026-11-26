import type { SourceFetchModeEnum, SourceStatusEnum, VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';

/**
 * A source as the report shows it
 */
export interface IReportSource {
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
   * Listing page
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
}

/**
 * A vacancy as the report shows it
 */
export interface IReportVacancy {
  /**
   * Vacancy id
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Source
   *
   * @var {number}
   */
  readonly sourceId: number;

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
   * Stage
   *
   * @var {VacancyStageEnum}
   */
  readonly stage: VacancyStageEnum;

  /**
   * Why the filter dropped it
   *
   * @var {string | null}
   */
  readonly skipReason: string | null;

  /**
   * Page of the position
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * The same position on the board of the company, when its own page is never opened
   *
   * @var {string | null}
   */
  readonly textURL: string | null;

  /**
   * First seen
   *
   * @var {Date}
   */
  readonly firstSeenAt: Date;
}

/**
 * A verdict against the current resume version of a profile
 */
export interface IReportMatch {
  /**
   * The vacancy
   *
   * @var {number}
   */
  readonly vacancyId: number;

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
   * Findings
   *
   * @var {readonly IMatchReason[]}
   */
  readonly reasons: readonly IMatchReason[];
}

/**
 * Everything the report is made from
 */
export interface IVacancyReportData {
  /**
   * Sources
   *
   * @var {readonly IReportSource[]}
   */
  readonly sources: readonly IReportSource[];

  /**
   * Their vacancies
   *
   * @var {readonly IReportVacancy[]}
   */
  readonly vacancies: readonly IReportVacancy[];

  /**
   * Verdicts against the current resume versions
   *
   * @var {readonly IReportMatch[]}
   */
  readonly matches: readonly IReportMatch[];
}
