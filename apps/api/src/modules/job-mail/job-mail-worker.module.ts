import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { QueueNameEnum } from '@job-agent/shared';

import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { JobMailConsumer } from './consumers/job-mail.consumer.js';
import { JobMailModule } from './job-mail.module.js';
import { JobMailScheduler } from './services/job-mail.scheduler.js';

/**
 * The `email` worker and the schedule of the mailbox reading — the API only
 */
@Module({
  imports: [JobMailModule, VacanciesModule, BullModule.registerQueue({ name: QueueNameEnum.EMAIL })],
  providers: [JobMailConsumer, JobMailScheduler]
})
export class JobMailWorkerModule {}
