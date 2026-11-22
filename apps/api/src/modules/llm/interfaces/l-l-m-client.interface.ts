import type { z } from 'zod';

import type { LLMProviderEnum } from '../enums/l-l-m-provider.enum.js';
import type { LLMStepEnum } from '../enums/l-l-m-step.enum.js';

/**
 * A request for an answer that must match a Zod schema
 *
 * @template TOutput
 */
export interface IStructuredRequest<TOutput> {
  /**
   * Pipeline step — selects the model from the environment
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

  /**
   * Upper bound of generated tokens
   *
   * @var {number}
   */
  readonly maxTokens: number;
}

/**
 * Availability of the provider and the models of every step
 */
export interface ILLMHealth {
  /**
   * Provider that was checked
   *
   * @var {LLMProviderEnum}
   */
  readonly provider: LLMProviderEnum;

  /**
   * True when the provider answers and every configured model exists
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
   * @param {IStructuredRequest<TOutput>} request
   *
   * @template TOutput
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<TOutput>}
   */
  generateStructured<TOutput>(request: IStructuredRequest<TOutput>): Promise<TOutput>;

  /**
   * Check the provider without spending tokens
   *
   * @param {number} timeoutMs
   *
   * @returns {Promise<ILLMHealth>}
   */
  checkHealth(timeoutMs: number): Promise<ILLMHealth>;
}
