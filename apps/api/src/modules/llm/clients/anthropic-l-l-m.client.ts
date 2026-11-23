import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Logger } from '@nestjs/common';

import { LLMProviderEnum } from '@job-agent/shared';

import { parseSchemaAnswer } from '../helpers/schema-answer.helper.js';
import type { IAnthropicLLMClientOptions } from '../interfaces/l-l-m-client-options.interface.js';
import type { ILLMHealth, ISchemaRequest, ISchemaResult } from '../interfaces/l-l-m-client.interface.js';
import { anthropicParamsSchema } from '../schemas/anthropic-params.schema.js';
import type { LLMSettingsService } from '../services/l-l-m-settings.service.js';
import { LLMClient } from './l-l-m.client.js';

/**
 * Stop reason of an answer cut by `max_tokens`
 *
 * @type {string}
 */
const STOP_REASON_MAX_TOKENS = 'max_tokens';

/**
 * LLM port adapter for the Anthropic API — structured output through `output_config.format`;
 * model and request parameters come from the step's row in `llm_settings`
 */
export class AnthropicLLMClient extends LLMClient {
  /**
   * Logger of the adapter
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(AnthropicLLMClient.name);

  /**
   * Anthropic SDK client
   *
   * @var {Anthropic}
   */
  private readonly client: Anthropic;

  /**
   * @param {IAnthropicLLMClientOptions} options
   * @param {LLMSettingsService} llmSettingsService
   */
  constructor(
    options: IAnthropicLLMClientOptions,
    private readonly llmSettingsService: LLMSettingsService
  ) {
    super();
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs });
  }

  /**
   * Ask Claude for an answer constrained by the request schema and validate it
   *
   * @param {ISchemaRequest<TOutput>} request
   *
   * @template TOutput
   *
   * @throws {Error} `LLM_OUTPUT_TRUNCATED` if the answer was cut by `max_tokens`
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<ISchemaResult<TOutput>>}
   */
  async generateBySchema<TOutput>(request: ISchemaRequest<TOutput>): Promise<ISchemaResult<TOutput>> {
    const settings = await this.llmSettingsService.findOne(request.step, anthropicParamsSchema);
    const effort = settings.params.thinking === 'adaptive' ? settings.params.effort : undefined;
    const message = await this.client.messages.create({
      model: settings.model,
      max_tokens: settings.params.max_tokens,
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
      thinking: { type: settings.params.thinking },
      output_config: { format: zodOutputFormat(request.schema), ...(effort ? { effort } : {}) }
    });

    this.logger.debug({
      message: 'Anthropic answer',
      step: request.step,
      model: settings.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      maxTokens: settings.params.max_tokens
    });

    if (message.stop_reason === STOP_REASON_MAX_TOKENS) {
      throw new Error(`LLM_OUTPUT_TRUNCATED: ${request.step} answer reached max_tokens ${settings.params.max_tokens}`);
    }

    const text = message.content.map(block => (block.type === 'text' ? block.text : '')).join('');

    return { data: parseSchemaAnswer(request.schema, text), model: settings.model };
  }

  /**
   * Retrieve every configured model — proves the key and the model names without spending tokens
   *
   * @param {number} timeoutMs
   *
   * @returns {Promise<ILLMHealth>}
   */
  async checkHealth(timeoutMs: number): Promise<ILLMHealth> {
    const { models, missingSteps } = await this.llmSettingsService.findAll();
    const results = await Promise.allSettled(
      models.map(model => this.client.models.retrieve(model, {}, { timeout: timeoutMs, maxRetries: 0 }))
    );
    const missingModels = models.filter((_model, index) => results[index]?.status === 'rejected');
    const failure = results.find(result => result.status === 'rejected');
    const health = { provider: LLMProviderEnum.ANTHROPIC, missingModels, missingSettings: missingSteps };

    if (failure) {
      const reason = failure.reason instanceof Error ? failure.reason.message : 'unknown error';

      this.logger.debug({ message: 'Anthropic health check failed', missingModels, reason });

      return { ...health, up: false, reason };
    }

    return { ...health, up: missingSteps.length === 0 };
  }
}
