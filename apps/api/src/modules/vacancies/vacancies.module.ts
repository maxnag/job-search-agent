import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { QueueNameEnum } from '@job-agent/shared';

import { VacancyRepository } from './repositories/vacancy.repository.js';
import { PipelineEventsService } from './services/pipeline-events.service.js';

/**
 * The vacancies every step of the pipeline reads and writes, and the jobs one step hands to the next
 */
@Module({
  imports: [BullModule.registerQueue({ name: QueueNameEnum.EXTRACT }, { name: QueueNameEnum.NOTIFY })],
  providers: [VacancyRepository, PipelineEventsService],
  exports: [VacancyRepository, PipelineEventsService]
})
export class VacanciesModule {}
