import { Injectable } from '@nestjs/common';

import { formatVacancyReport } from '../helpers/vacancy-report.helper.js';
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
   * The report of one source, or of all
   *
   * @param {number} [sourceId]
   *
   * @returns {Promise<string>}
   */
  async build(sourceId?: number): Promise<string> {
    return formatVacancyReport(await this.vacancyReportRepository.findAll(sourceId));
  }
}
