import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { JobNameEnum, SchedulerIdEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { JobMailReadOrchestrator } from './job-mail-read.orchestrator.js';

/**
 * Milliseconds in a minute
 *
 * @type {number}
 */
const MINUTE_MS = 60_000;

/**
 * Keeps the Job Scheduler of the `email` queue: the mailbox is read every `JOB_MAIL_INTERVAL_MINUTES`; removed while
 * the provider has no keys, and when the mailbox refuses them — until the API starts again
 */
@Injectable()
export class JobMailScheduler implements OnApplicationBootstrap {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(JobMailScheduler.name);

  /**
   * @param {JobMailReadOrchestrator} jobMailReadOrchestrator
   * @param {Queue} emailQueue
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly jobMailReadOrchestrator: JobMailReadOrchestrator,
    @InjectQueue('email') private readonly emailQueue: Queue,
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
   * Remove the scheduler — the mailbox refused the account
   *
   * @returns {Promise<void>}
   */
  async stop(): Promise<void> {
    await this.emailQueue.removeJobScheduler(SchedulerIdEnum.READ_JOB_MAIL);
    this.logger.warn({ message: 'Job mail reading stopped until the API starts again' });
  }

  /**
   * Upsert the scheduler, or remove it when the provider has no keys
   *
   * @returns {Promise<void>}
   */
  private async schedule(): Promise<void> {
    const minutes = this.configService.get('JOB_MAIL_INTERVAL_MINUTES', { infer: true });

    try {
      if (!this.jobMailReadOrchestrator.isEnabled()) {
        await this.emailQueue.removeJobScheduler(SchedulerIdEnum.READ_JOB_MAIL);
        this.logger.warn({ message: 'Job mail not scheduled: JOB_MAIL_IMAP_USER and JOB_MAIL_IMAP_PASSWORD are not set' });

        return;
      }

      await this.emailQueue.upsertJobScheduler(
        SchedulerIdEnum.READ_JOB_MAIL,
        { every: minutes * MINUTE_MS },
        { name: JobNameEnum.READ_JOB_MAIL }
      );

      this.logger.log({ message: 'Job mail scheduled', everyMinutes: minutes });
    } catch (error) {
      this.logger.error(`Job mail not scheduled: ${(error as Error).message}`, (error as Error).stack);
    }
  }
}
