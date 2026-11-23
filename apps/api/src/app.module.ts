import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createConfigModule } from './config/config-module.factory.js';
import { loggerParams } from './config/logger-params.helper.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { ExtractionModule } from './modules/extraction/extraction.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LLMModule } from './modules/llm/l-l-m.module.js';
import { NotifyModule } from './modules/notify/notify.module.js';
import { QueuesModule } from './modules/queues/queues.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { SearchWorkerModule } from './modules/search/search-worker.module.js';

/**
 * Root module of the API
 */
@Module({
  imports: [
    createConfigModule(),
    LoggerModule.forRootAsync({ inject: [ConfigService], useFactory: loggerParams }),
    DatabaseModule,
    RedisModule,
    QueuesModule.forRoot(),
    LLMModule,
    HealthModule,
    SearchWorkerModule,
    ExtractionModule,
    NotifyModule
  ]
})
export class AppModule {}
