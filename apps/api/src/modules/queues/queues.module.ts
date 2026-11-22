import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { QUEUE_NAMES } from '@job-agent/shared';

import type { IEnv } from '../../config/env.schema.js';

/**
 * BullMQ connection, the pipeline queues and Bull Board
 */
@Module({})
export class QueuesModule {
  /**
   * Register the Redis connection, every queue of the registry and the Bull Board route
   *
   * @returns {DynamicModule}
   */
  static forRoot(): DynamicModule {
    const queues = QUEUE_NAMES.map(name => ({ name }));

    return {
      module: QueuesModule,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService<IEnv, true>) => {
            const host: string = configService.get('REDIS_HOST', { infer: true });
            const port: number = configService.get('REDIS_PORT', { infer: true });

            return { connection: { host, port, maxRetriesPerRequest: null } };
          }
        }),
        BullModule.registerQueue(...queues),
        BullBoardModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService<IEnv, true>) => ({
            route: configService.get('BULL_BOARD_PATH', { infer: true }),
            adapter: ExpressAdapter
          })
        }),
        BullBoardModule.forFeature(...queues.map(queue => ({ ...queue, adapter: BullMQAdapter })))
      ],
      exports: [BullModule]
    };
  }
}
