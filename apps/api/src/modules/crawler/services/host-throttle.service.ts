import { setTimeout as delay } from 'node:timers/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';
import { randomDelayMs } from '../helpers/random-delay.helper.js';

/**
 * One request at a time per host, with a random pause after each — the only place that holds state between jobs:
 * the queue of a host lives as long as the process
 */
@Injectable()
export class HostThrottleService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(HostThrottleService.name);

  /**
   * The last request queued per host, settled — the next one waits for it
   *
   * @var {Map<string, Promise<unknown>>}
   */
  private readonly tails = new Map<string, Promise<unknown>>();

  /**
   * When the last request to a host finished, epoch ms
   *
   * @var {Map<string, number>}
   */
  private readonly finishedAt = new Map<string, number>();

  /**
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(private readonly configService: ConfigService<IEnv, true>) {}

  /**
   * Run a request to a host after the requests queued before it and a random pause since the last one finished
   *
   * @param {string} host
   * @param {() => Promise<T>} request
   *
   * @template T
   *
   * @returns {Promise<T>}
   */
  async run<T>(host: string, request: () => Promise<T>): Promise<T> {
    const turn = this.takeTurn(host, this.tails.get(host), request);

    this.tails.set(host, Promise.allSettled([turn]));

    return turn;
  }

  /**
   * Wait for the previous request and the pause, then make the request and note when it finished
   *
   * @param {string} host
   * @param {Promise<unknown> | undefined} previous
   * @param {() => Promise<T>} request
   *
   * @template T
   *
   * @returns {Promise<T>}
   */
  private async takeTurn<T>(host: string, previous: Promise<unknown> | undefined, request: () => Promise<T>): Promise<T> {
    await previous;

    const waitMs = this.waitMs(host);

    if (waitMs > 0) {
      this.logger.debug({ message: 'Crawl pause', host, waitMs });

      await delay(waitMs);
    }

    try {
      return await request();
    } finally {
      this.finishedAt.set(host, Date.now());
    }
  }

  /**
   * How long to wait before the next request to a host: none for the first one
   *
   * @param {string} host
   *
   * @returns {number}
   */
  private waitMs(host: string): number {
    const finishedAt = this.finishedAt.get(host);

    if (finishedAt === undefined) {
      return 0;
    }

    const pauseMs = randomDelayMs(
      this.configService.get('CRAWL_DELAY_MIN_MS', { infer: true }),
      this.configService.get('CRAWL_DELAY_MAX_MS', { infer: true })
    );

    return Math.max(0, finishedAt + pauseMs - Date.now());
  }
}
