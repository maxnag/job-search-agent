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
 * Keeps the Job Schedulers of the `search` queue: the scan of the sources every `SEARCH_INTERVAL_HOURS`, and the
 * discovery of company boards on the `DISCOVER_CRON` schedule — a cron schedule, so neither its creation nor a restart
 * runs it at once; removed while `BRAVE_SEARCH_API_KEY` is not set
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
   * Upsert the schedulers; the intervals follow the environment on every start
   *
   * @returns {Promise<void>}
   */
  private async schedule(): Promise<void> {
    await this.scheduleScans();
    await this.scheduleDiscovery();
  }

  /**
   * Upsert the scheduler of the source scans
   *
   * @returns {Promise<void>}
   */
  private async scheduleScans(): Promise<void> {
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

  /**
   * Upsert the scheduler of the discovery, or remove it when the web search has no key
   *
   * @returns {Promise<void>}
   */
  private async scheduleDiscovery(): Promise<void> {
    const pattern = this.configService.get('DISCOVER_CRON', { infer: true });

    try {
      if (!this.configService.get('BRAVE_SEARCH_API_KEY', { infer: true })) {
        await this.searchQueue.removeJobScheduler(SchedulerIdEnum.DISCOVER_SOURCES);
        this.logger.warn({ message: 'Discovery not scheduled: BRAVE_SEARCH_API_KEY is not set' });

        return;
      }

      await this.searchQueue.upsertJobScheduler(SchedulerIdEnum.DISCOVER_SOURCES, { pattern }, { name: JobNameEnum.DISCOVER_SOURCES });

      this.logger.log({ message: 'Discovery scheduled', cron: pattern });
    } catch (error) {
      this.logger.error(`Discovery not scheduled: ${(error as Error).message}`, (error as Error).stack);
    }
  }
}
