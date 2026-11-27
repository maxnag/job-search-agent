import { Module } from '@nestjs/common';

import { JobsDBRepository } from '../jobs-db/repositories/jobs-db.repository.js';
import { NotificationRepository } from '../notify/repositories/notification.repository.js';
import { VacancyActionService } from '../notify/services/vacancy-action.service.js';
import { ReportModule } from '../report/report.module.js';
import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { VacanciesController } from './controllers/vacancies.controller.js';
import { VacancyFilterOptionsRepository } from './repositories/vacancy-filter-options.repository.js';
import { VacanciesAPIService } from './services/vacancies-a-p-i.service.js';

/**
 * REST API of the web UI under `/api/vacancies`. The read repository of the MCP server and the action service are
 * provided here, not imported with their modules, which would bring the MCP tools and the Telegram bot
 */
@Module({
  imports: [ReportModule, VacanciesModule],
  controllers: [VacanciesController],
  providers: [JobsDBRepository, NotificationRepository, VacancyActionService, VacancyFilterOptionsRepository, VacanciesAPIService]
})
export class VacanciesAPIModule {}
