import type { IVacancyData } from '../../vacancies/interfaces/vacancy-data.interface.js';

/**
 * `vacancy_data` as the extraction wrote it, or undefined for a row without one or with another shape
 *
 * @param {Record<string, unknown> | null} data
 *
 * @returns {IVacancyData | undefined}
 */
export function readVacancyData(data: Record<string, unknown> | null): IVacancyData | undefined {
  if (!data || !Array.isArray(data.requiredLanguages) || !Array.isArray(data.preferredLanguages) || typeof data.hebrew !== 'string') {
    return undefined;
  }

  return data as unknown as IVacancyData;
}
