import { Module } from '@nestjs/common';

import { createConfigModule } from '../config/config-module.factory.js';
import { DatabaseModule } from '../modules/database/database.module.js';
import { QueuesModule } from '../modules/queues/queues.module.js';
import { SearchModule } from '../modules/search/search.module.js';

/**
 * Root module of `sources:scan`: the scan needs the queues to hand the vacancies over to the extraction of the
 * running API — it runs no worker and no HTTP itself
 */
@Module({
  imports: [createConfigModule(), DatabaseModule, QueuesModule.forCommands(), SearchModule]
})
export class ScanCLIModule {}
