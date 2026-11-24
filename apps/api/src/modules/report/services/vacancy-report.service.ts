import { Injectable } from '@nestjs/common';

import { formatVacancyReport } from '../helpers/vacancy-report.helper.js';
import type { IVacancyReportFilter } from '../interfaces/vacancy-report-filter.interface.js';
import { VacancyReportRepository } from '../repositories/vacancy-report.repository.js';

/**
 * Builds the report of every position for the owner
 */
@Injectable()
export class VacancyReportService {
  /**
   * @param {VacancyReportRepository} vacancyReportRepository
   */
  constructor(private readonly vacancyReportRepository: VacancyReportRepository) {}

  /**
   * The report of the positions the filter selects — every open one by default; a summary gives only the counts
   *
   * @param {IVacancyReportFilter} [filter]
   * @param {boolean} [summary]
   *
   * @returns {Promise<string>}
   */
  async build(filter: IVacancyReportFilter = {}, summary = false): Promise<string> {
    return formatVacancyReport(await this.vacancyReportRepository.findAll(filter), filter, summary);
  }
}
