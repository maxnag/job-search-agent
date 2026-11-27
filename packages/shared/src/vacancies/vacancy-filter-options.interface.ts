/**
 * A source the list can be filtered by
 */
export interface IVacancyFilterSource {
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
}

/**
 * A city the list can be filtered by, with the country it is in
 */
export interface IVacancyFilterCity {
  /**
   * Country code, if known
   *
   * @var {string | null}
   */
  readonly country: string | null;

  /**
   * City
   *
   * @var {string}
   */
  readonly city: string;
}

/**
 * Values the filters of the list offer — what the open vacancies have
 */
export interface IVacancyFilterOptions {
  /**
   * Sources with open vacancies, by name
   *
   * @var {readonly IVacancyFilterSource[]}
   */
  readonly sources: readonly IVacancyFilterSource[];

  /**
   * Country codes
   *
   * @var {readonly string[]}
   */
  readonly countries: readonly string[];

  /**
   * Cities with their countries, by country then city
   *
   * @var {readonly IVacancyFilterCity[]}
   */
  readonly cities: readonly IVacancyFilterCity[];
}
