import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Logger } from '@nestjs/common';

import { LLMProviderEnum } from '../enums/l-l-m-provider.enum.js';
import { parseStructuredOutput } from '../helpers/structured-output.helper.js';
import type { ILLMHealth, IStructuredRequest } from '../interfaces/l-l-m-client.interface.js';
import type { LLMModelService } from '../services/l-l-m-model.service.js';
import { LLMClient } from './l-l-m.client.js';

/**
 * Settings of the Anthropic adapter
 */
export interface IAnthropicLLMClientOptions {
  /**
   * Anthropic API key
   *
   * @var {string}
   */
  readonly apiKey: string;

  /**
   * Timeout of one request
   *
   * @var {number}
   */
  readonly timeoutMs: number;
}

/**
 * LLM port adapter for the Anthropic API — structured output through `output_config.format`
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
   * @param {LLMModelService} llmModelService
   */
  constructor(
    options: IAnthropicLLMClientOptions,
    private readonly llmModelService: LLMModelService
  ) {
    super();
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs });
  }

  /**
   * Ask Claude for an answer constrained by the request schema and validate it
   *
   * @param {IStructuredRequest<TOutput>} request
   *
   * @template TOutput
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<TOutput>}
   */
  async generateStructured<TOutput>(request: IStructuredRequest<TOutput>): Promise<TOutput> {
    const message = await this.client.messages.create({
      model: this.llmModelService.resolve(request.step),
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
      output_config: { format: zodOutputFormat(request.schema) }
    });

    const text = message.content.map(block => (block.type === 'text' ? block.text : '')).join('');

    return parseStructuredOutput(request.schema, text);
  }

  /**
   * Retrieve every configured model — proves the key and the model names without spending tokens
   *
   * @param {number} timeoutMs
   *
   * @returns {Promise<ILLMHealth>}
   */
  async checkHealth(timeoutMs: number): Promise<ILLMHealth> {
    const models = this.llmModelService.findAll();
    const results = await Promise.allSettled(
      models.map(model => this.client.models.retrieve(model, {}, { timeout: timeoutMs, maxRetries: 0 }))
    );
    const missingModels = models.filter((_model, index) => results[index]?.status === 'rejected');
    const failure = results.find(result => result.status === 'rejected');

    if (failure) {
      const reason = failure.reason instanceof Error ? failure.reason.message : 'unknown error';

      this.logger.debug({ message: 'Anthropic health check failed', missingModels, reason });

      return { provider: LLMProviderEnum.ANTHROPIC, up: false, missingModels, reason };
    }

    return { provider: LLMProviderEnum.ANTHROPIC, up: true, missingModels: [] };
  }
}
