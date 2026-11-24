import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { QueueNameEnum } from '@job-agent/shared';

import { DiscoveryModule } from '../discovery/discovery.module.js';
import { SearchConsumer } from './consumers/search.consumer.js';
import { SearchModule } from './search.module.js';
import { SearchScheduler } from './services/search.scheduler.js';

/**
 * The `search` worker and the schedule of the scans — the API only
 */
@Module({
  imports: [DiscoveryModule, SearchModule, BullModule.registerQueue({ name: QueueNameEnum.SEARCH })],
  providers: [SearchConsumer, SearchScheduler]
})
export class SearchWorkerModule {}
