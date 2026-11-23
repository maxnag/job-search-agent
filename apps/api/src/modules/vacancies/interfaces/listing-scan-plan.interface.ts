import type { VacancyInsertType, VacancyUpdateType } from './vacancy-row.interface.js';

/**
 * A change of one known vacancy decided by a scan
 */
export interface IVacancyUpdate {
  /**
   * Vacancy to change
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Columns to write
   *
   * @var {VacancyUpdateType}
   */
  readonly values: VacancyUpdateType;
}

/**
 * Everything one scan of a listing page writes, applied in one transaction
 */
export interface IListingScanPlan {
  /**
   * New vacancies
   *
   * @var {readonly VacancyInsertType[]}
   */
  readonly inserts: readonly VacancyInsertType[];

  /**
   * Known vacancies seen again
   *
   * @var {readonly IVacancyUpdate[]}
   */
  readonly updates: readonly IVacancyUpdate[];

  /**
   * Open vacancies of the source gone from its page
   *
   * @var {readonly number[]}
   */
  readonly closeIds: readonly number[];

  /**
   * Extracted vacancies seen again whose page is due to be read again
   *
   * @var {readonly number[]}
   */
  readonly recheckIds: readonly number[];
}

/**
 * Rows a scan wrote
 */
export interface IListingScanResult {
  /**
   * Inserted vacancies
   *
   * @var {readonly IScannedVacancy[]}
   */
  readonly created: readonly IScannedVacancy[];

  /**
   * Vacancies seen again
   *
   * @var {readonly IScannedVacancy[]}
   */
  readonly updated: readonly IScannedVacancy[];

  /**
   * Vacancies closed
   *
   * @var {readonly number[]}
   */
  readonly closedIds: readonly number[];
}

/**
 * Id and stage of a vacancy a scan wrote
 */
export interface IScannedVacancy {
  /**
   * Vacancy id
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Stage after the scan
   *
   * @var {VacancyInsertType["vacancy_stage"]}
   */
  readonly stage: VacancyInsertType['vacancy_stage'];
}
