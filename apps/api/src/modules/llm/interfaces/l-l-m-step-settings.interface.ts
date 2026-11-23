import type { LLMStepEnum } from '@job-agent/shared';

/**
 * Settings of one step for the provider in use
 *
 * @template TParams
 */
export interface ILLMStepSettings<TParams> {
  /**
   * Pipeline step
   *
   * @var {LLMStepEnum}
   */
  readonly step: LLMStepEnum;

  /**
   * Model name
   *
   * @var {string}
   */
  readonly model: string;

  /**
   * Request parameters under the provider's own names, validated by the provider's schema
   *
   * @var {TParams}
   */
  readonly params: TParams;
}

/**
 * Every settings row of the provider in use, and the steps that have none
 */
export interface ILLMSettingsOverview {
  /**
   * Distinct models the steps use
   *
   * @var {readonly string[]}
   */
  readonly models: readonly string[];

  /**
   * Steps without a settings row
   *
   * @var {readonly LLMStepEnum[]}
   */
  readonly missingSteps: readonly LLMStepEnum[];
}
