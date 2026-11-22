import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { RedisService } from '../../redis/services/redis.service.js';
import { withTimeout } from '../helpers/with-timeout.helper.js';
import type { HealthStateType, IHealthReport } from '../interfaces/health-report.interface.js';

/**
 * Checks Postgres, Redis and the LLM provider, each within the health-check timeout
 */
@Injectable()
export class HealthService {
  /**
   * Logger of the service
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(HealthService.name);

  /**
   * @param {DatabaseService} databaseService
   * @param {RedisService} redisService
   * @param {LLMClient} llmClient
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly llmClient: LLMClient,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Check every dependency in parallel
   *
   * @returns {Promise<IHealthReport>}
   */
  async check(): Promise<IHealthReport> {
    const timeoutMs = this.configService.get('HEALTH_CHECK_TIMEOUT_MS', { infer: true });
    const [postgres, redis, llm] = await Promise.all([
      this.probe('postgres', async () => this.databaseService.ping(), timeoutMs),
      this.probe('redis', async () => this.redisService.ping(), timeoutMs),
      this.llmClient.checkHealth(timeoutMs)
    ]);

    return {
      status: postgres === 'up' && redis === 'up' ? 'ok' : 'error',
      version: this.configService.get('APP_VERSION', { infer: true }),
      checks: { postgres, redis, llm: llm.up ? 'up' : 'down' },
      llm: { provider: llm.provider, missingModels: llm.missingModels }
    };
  }

  /**
   * Run one check and turn its outcome into a state
   *
   * @param {string} name
   * @param {() => Promise<void>} operation
   * @param {number} timeoutMs
   *
   * @returns {Promise<HealthStateType>}
   */
  private async probe(name: string, operation: () => Promise<void>, timeoutMs: number): Promise<HealthStateType> {
    try {
      await withTimeout(operation, timeoutMs);

      return 'up';
    } catch (error) {
      this.logger.debug({ message: 'Health check failed', check: name, reason: error instanceof Error ? error.message : 'unknown' });

      return 'down';
    }
  }
}
