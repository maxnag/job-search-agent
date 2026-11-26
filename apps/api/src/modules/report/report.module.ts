import { Module } from '@nestjs/common';

import { VacancyReportRepository } from './repositories/vacancy-report.repository.js';
import { VacancyReportService } from './services/vacancy-report.service.js';

/**
 * The report of every position — database only, the commands and the MCP server use it
 */
@Module({
  providers: [VacancyReportRepository, VacancyReportService],
  exports: [VacancyReportRepository, VacancyReportService]
})
export class ReportModule {}
