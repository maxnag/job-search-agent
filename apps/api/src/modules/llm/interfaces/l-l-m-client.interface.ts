import type { z } from 'zod';

import type { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

/**
 * A request for an answer that must match a Zod schema
 *
 * @template TOutput
 */
export interface ISchemaRequest<TOutput> {
  /**
   * Pipeline step — selects the model and its parameters from `llm_settings`
   *
   * @var {LLMStepEnum}
   */
  readonly step: LLMStepEnum;

  /**
   * System instructions
   *
   * @var {string}
   */
  readonly system?: string;

  /**
   * User message
   *
   * @var {string}
   */
  readonly prompt: string;

  /**
   * Schema of the answer: sent to the provider as JSON Schema and checked on the way back
   *
   * @var {z.ZodType<TOutput>}
   */
  readonly schema: z.ZodType<TOutput>;
}

/**
 * A validated answer and the model that gave it
 *
 * @template TOutput
 */
export interface ISchemaResult<TOutput> {
  /**
   * Answer validated against the request schema
   *
   * @var {TOutput}
   */
  readonly data: TOutput;

  /**
   * Model that produced the answer
   *
   * @var {string}
   */
  readonly model: string;
}

/**
 * Availability of the provider, its models and the settings of every step
 */
export interface ILLMHealth {
  /**
   * Provider that was checked
   *
   * @var {LLMProviderEnum}
   */
  readonly provider: LLMProviderEnum;

  /**
   * True when the provider answers, every configured model exists and every step has settings
   *
   * @var {boolean}
   */
  readonly up: boolean;

  /**
   * Configured models the provider does not have
   *
   * @var {readonly string[]}
   */
  readonly missingModels: readonly string[];

  /**
   * Steps without a row in `llm_settings`
   *
   * @var {readonly LLMStepEnum[]}
   */
  readonly missingSettings: readonly LLMStepEnum[];

  /**
   * Why the check failed
   *
   * @var {string}
   */
  readonly reason?: string;
}

/**
 * The LLM port — agents and extractors depend on it, never on a provider SDK
 */
export interface ILLMClient {
  /**
   * Ask for an answer and return it validated against the request schema
   *
   * @param {ISchemaRequest<TOutput>} request
   *
   * @template TOutput
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<ISchemaResult<TOutput>>}
   */
  generateBySchema<TOutput>(request: ISchemaRequest<TOutput>): Promise<ISchemaResult<TOutput>>;

  /**
   * Check the provider without spending tokens
   *
   * @param {number} timeoutMs
   *
   * @returns {Promise<ILLMHealth>}
   */
  checkHealth(timeoutMs: number): Promise<ILLMHealth>;
}
