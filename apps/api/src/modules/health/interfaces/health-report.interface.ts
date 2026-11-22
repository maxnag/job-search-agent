import type { LLMProviderEnum } from '../../llm/enums/l-l-m-provider.enum.js';

/**
 * State of one dependency
 */
export type HealthStateType = 'up' | 'down';

/**
 * Result of `GET /health`
 */
export interface IHealthReport {
  /**
   * `ok` when Postgres and Redis are up; the LLM never makes the application unhealthy
   *
   * @var {'ok' | 'error'}
   */
  readonly status: 'ok' | 'error';

  /**
   * Application version
   *
   * @var {string}
   */
  readonly version: string;

  /**
   * State of every dependency
   *
   * @var {object}
   */
  readonly checks: {
    readonly postgres: HealthStateType;
    readonly redis: HealthStateType;
    readonly llm: HealthStateType;
  };

  /**
   * LLM provider and the configured models it lacks
   *
   * @var {object}
   */
  readonly llm: {
    readonly provider: LLMProviderEnum;
    readonly missingModels: readonly string[];
  };
}
