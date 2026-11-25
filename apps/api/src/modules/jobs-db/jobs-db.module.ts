import { Module } from '@nestjs/common';

import { NotificationRepository } from '../notify/repositories/notification.repository.js';
import { VacancyActionService } from '../notify/services/vacancy-action.service.js';
import { ReportModule } from '../report/report.module.js';
import { JobsDBRepository } from './repositories/jobs-db.repository.js';
import { JobsDBToolsService } from './services/jobs-db-tools.service.js';
import { FindVacanciesTool } from './tools/find-vacancies.tool.js';
import { GetVacancyTool } from './tools/get-vacancy.tool.js';
import { ListApplicationsTool } from './tools/list-applications.tool.js';
import { ListSourceCandidatesTool } from './tools/list-source-candidates.tool.js';
import { ListSourcesTool } from './tools/list-sources.tool.js';
import { PipelineSummaryTool } from './tools/pipeline-summary.tool.js';
import { RecordActionTool } from './tools/record-action.tool.js';

/**
 * The tools of the `jobs-db` MCP server — database only. The action service and its repository are provided here, not
 * imported with the notify module, which would bring the queues and Redis
 */
@Module({
  imports: [ReportModule],
  providers: [
    JobsDBRepository,
    NotificationRepository,
    VacancyActionService,
    FindVacanciesTool,
    GetVacancyTool,
    ListApplicationsTool,
    PipelineSummaryTool,
    ListSourcesTool,
    ListSourceCandidatesTool,
    RecordActionTool,
    JobsDBToolsService
  ],
  exports: [JobsDBToolsService]
})
export class JobsDBModule {}
