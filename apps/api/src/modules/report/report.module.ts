import { Module } from '@nestjs/common';

import { VacancyReportRepository } from './repositories/vacancy-report.repository.js';
import { VacancyReportService } from './services/vacancy-report.service.js';

/**
 * The report of every position — database only, the commands use it
 */
@Module({
  providers: [VacancyReportRepository, VacancyReportService],
  exports: [VacancyReportService]
})
export class ReportModule {}
