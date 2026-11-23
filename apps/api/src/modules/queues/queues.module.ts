import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { QUEUE_NAMES } from '@job-agent/shared';

import type { IEnv } from '../../config/env.schema.js';

/**
 * Completed jobs kept per queue for Bull Board
 *
 * @type {number}
 */
const KEPT_COMPLETED_JOBS = 1000;

/**
 * Failed jobs kept per queue — the owner reads why they failed
 *
 * @type {number}
 */
const KEPT_FAILED_JOBS = 5000;

/**
 * The Redis connection of every queue, with the default retry policy of every job
 *
 * @returns {DynamicModule}
 */
function bullRoot(): DynamicModule {
  return BullModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (configService: ConfigService<IEnv, true>) => {
      const host: string = configService.get('REDIS_HOST', { infer: true });
      const port: number = configService.get('REDIS_PORT', { infer: true });

      return {
        connection: { host, port, maxRetriesPerRequest: null },
        defaultJobOptions: {
          attempts: configService.get('JOB_ATTEMPTS', { infer: true }),
          backoff: { type: 'exponential', delay: configService.get('JOB_BACKOFF_MS', { infer: true }) },
          removeOnComplete: { count: KEPT_COMPLETED_JOBS },
          removeOnFail: { count: KEPT_FAILED_JOBS }
        }
      };
    }
  });
}

/**
 * BullMQ connection, the pipeline queues and Bull Board
 */
@Module({})
export class QueuesModule {
  /**
   * Register the Redis connection, every queue of the registry and the Bull Board route. Finished jobs are kept for
   * a while — Bull Board shows them, deduplication ids are freed
   *
   * @returns {DynamicModule}
   */
  static forRoot(): DynamicModule {
    const queues = QUEUE_NAMES.map(name => ({ name }));

    return {
      module: QueuesModule,
      imports: [
        bullRoot(),
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

  /**
   * Register the Redis connection and every queue for a command — it adds jobs, runs no worker, has no HTTP
   *
   * @returns {DynamicModule}
   */
  static forCommands(): DynamicModule {
    return {
      module: QueuesModule,
      imports: [bullRoot(), BullModule.registerQueue(...QUEUE_NAMES.map(name => ({ name })))],
      exports: [BullModule]
    };
  }
}
