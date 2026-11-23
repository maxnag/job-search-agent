import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { JobNameEnum, SchedulerIdEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';

/**
 * Milliseconds in a minute
 *
 * @type {number}
 */
const MINUTE_MS = 60_000;

/**
 * Keeps the Job Scheduler that queues the cards not sent yet every `NOTIFY_SWEEP_MINUTES`
 */
@Injectable()
export class NotifyScheduler implements OnApplicationBootstrap {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(NotifyScheduler.name);

  /**
   * @param {Queue} notifyQueue
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    @InjectQueue('notify') private readonly notifyQueue: Queue,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Create or update the scheduler without holding up the start
   *
   * @returns {void}
   */
  onApplicationBootstrap(): void {
    void this.schedule();
  }

  /**
   * Upsert the scheduler; the interval follows the environment on every start
   *
   * @returns {Promise<void>}
   */
  private async schedule(): Promise<void> {
    const minutes = this.configService.get('NOTIFY_SWEEP_MINUTES', { infer: true });

    try {
      await this.notifyQueue.upsertJobScheduler(
        SchedulerIdEnum.NOTIFY_PENDING,
        { every: minutes * MINUTE_MS },
        { name: JobNameEnum.NOTIFY_PENDING }
      );

      this.logger.log({ message: 'Pending cards sweep scheduled', everyMinutes: minutes });
    } catch (error) {
      this.logger.error(`Pending cards sweep not scheduled: ${(error as Error).message}`, (error as Error).stack);
    }
  }
}
