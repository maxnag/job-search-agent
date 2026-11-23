import type { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

/**
 * State of one dependency
 */
export type HealthStateType = 'up' | 'down';

/**
 * What `GET /health` shows in production: no details of the dependencies leave the process
 */
export interface IHealthStatus {
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
}

/**
 * What `GET /health` shows in development and test: the state of every dependency
 */
export interface IHealthReport extends IHealthStatus {
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
   * LLM provider, the configured models it lacks and the steps without settings
   *
   * @var {object}
   */
  readonly llm: {
    readonly provider: LLMProviderEnum;
    readonly missingModels: readonly string[];
    readonly missingSettings: readonly LLMStepEnum[];
  };
}
