import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { IEnv } from '../../../config/env.schema.js';

/**
 * Redis client of the application itself (health checks, future keys);
 * BullMQ opens its own connections from the same settings
 */
@Injectable()
export class RedisService implements OnApplicationShutdown {
  /**
   * Logger of the service
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(RedisService.name);

  /**
   * ioredis client
   *
   * @var {Redis}
   */
  private readonly client: Redis;

  /**
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(private readonly configService: ConfigService<IEnv, true>) {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', { infer: true }),
      port: this.configService.get('REDIS_PORT', { infer: true }),
      connectTimeout: this.configService.get('HEALTH_CHECK_TIMEOUT_MS', { infer: true }),
      maxRetriesPerRequest: 1
    });

    this.client.on('error', (error: Error) => {
      this.logger.warn({ message: 'Redis connection error', error: error.message });
    });
  }

  /**
   * Send `PING` to prove Redis answers
   *
   * @returns {Promise<void>}
   */
  async ping(): Promise<void> {
    await this.client.ping();
  }

  /**
   * Close the connection
   *
   * @returns {Promise<void>}
   */
  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}
