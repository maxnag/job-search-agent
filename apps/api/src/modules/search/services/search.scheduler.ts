import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { JobNameEnum, SchedulerIdEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';

/**
 * Milliseconds in an hour
 *
 * @type {number}
 */
const HOUR_MS = 3_600_000;

/**
 * Keeps the Job Scheduler that scans the sources every `SEARCH_INTERVAL_HOURS`
 */
@Injectable()
export class SearchScheduler implements OnApplicationBootstrap {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(SearchScheduler.name);

  /**
   * @param {Queue} searchQueue
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    @InjectQueue('search') private readonly searchQueue: Queue,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Create or update the scheduler without holding up the start — an unreachable Redis is reported, not fatal
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
    const hours = this.configService.get('SEARCH_INTERVAL_HOURS', { infer: true });

    try {
      await this.searchQueue.upsertJobScheduler(
        SchedulerIdEnum.SCAN_SOURCES,
        { every: hours * HOUR_MS },
        { name: JobNameEnum.SCAN_SOURCES }
      );

      this.logger.log({ message: 'Source scans scheduled', everyHours: hours });
    } catch (error) {
      this.logger.error(`Source scans not scheduled: ${(error as Error).message}`, (error as Error).stack);
    }
  }
}
