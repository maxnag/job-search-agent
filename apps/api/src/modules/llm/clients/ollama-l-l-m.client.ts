import { Logger } from '@nestjs/common';
import { Ollama } from 'ollama';
import { z } from 'zod';

import { LLMProviderEnum } from '@job-agent/shared';

import { parseSchemaAnswer } from '../helpers/schema-answer.helper.js';
import type { IOllamaLLMClientOptions } from '../interfaces/l-l-m-client-options.interface.js';
import type { ILLMHealth, ISchemaRequest, ISchemaResult } from '../interfaces/l-l-m-client.interface.js';
import { ollamaParamsSchema } from '../schemas/ollama-params.schema.js';
import type { LLMSettingsService } from '../services/l-l-m-settings.service.js';
import { LLMClient } from './l-l-m.client.js';

/**
 * Tag Ollama adds to a model pulled without one
 *
 * @type {string}
 */
const DEFAULT_TAG = ':latest';

/**
 * LLM port adapter for a local Ollama — structured output through the `format` parameter
 */
export class OllamaLLMClient extends LLMClient {
  /**
   * Logger of the adapter
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(OllamaLLMClient.name);

  /**
   * Ollama server URL
   *
   * @var {string}
   */
  private readonly url: string;

  /**
   * Timeout of one generation request
   *
   * @var {number}
   */
  private readonly timeoutMs: number;

  /**
   * @param {IOllamaLLMClientOptions} options
   * @param {LLMSettingsService} llmSettingsService
   */
  constructor(
    options: IOllamaLLMClientOptions,
    private readonly llmSettingsService: LLMSettingsService
  ) {
    super();
    this.url = options.url;
    this.timeoutMs = options.timeoutMs;
  }

  /**
   * Ask the step model for an answer constrained by the request schema and validate it
   *
   * @param {ISchemaRequest<TOutput>} request
   *
   * @template TOutput
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<ISchemaResult<TOutput>>}
   */
  async generateBySchema<TOutput>(request: ISchemaRequest<TOutput>): Promise<ISchemaResult<TOutput>> {
    const settings = await this.llmSettingsService.findOne(request.step, ollamaParamsSchema);
    const messages = request.system ? [{ role: 'system', content: request.system }] : [];
    const response = await this.createClient(this.timeoutMs).chat({
      model: settings.model,
      messages: [...messages, { role: 'user', content: request.prompt }],
      format: z.toJSONSchema(request.schema),
      options: settings.params,
      stream: false
    });

    return { data: parseSchemaAnswer(request.schema, response.message.content), model: settings.model };
  }

  /**
   * List the local models and check that every configured one is pulled
   *
   * @param {number} timeoutMs
   *
   * @returns {Promise<ILLMHealth>}
   */
  async checkHealth(timeoutMs: number): Promise<ILLMHealth> {
    const { models, missingSteps } = await this.llmSettingsService.findAll();
    const health = { provider: LLMProviderEnum.OLLAMA, missingSettings: missingSteps };

    try {
      const { models: pulled } = await this.createClient(timeoutMs).list();
      const names = new Set(pulled.map(model => model.name));
      const missingModels = models.filter(model => !names.has(model) && !names.has(`${model}${DEFAULT_TAG}`));

      return { ...health, up: missingModels.length === 0 && missingSteps.length === 0, missingModels };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';

      this.logger.debug({ message: 'Ollama health check failed', reason });

      return { ...health, up: false, missingModels: models, reason };
    }
  }

  /**
   * Ollama client whose every request is aborted after the timeout
   *
   * @param {number} timeoutMs
   *
   * @returns {Ollama}
   */
  private createClient(timeoutMs: number): Ollama {
    return new Ollama({
      host: this.url,
      fetch: async (input, init) => {
        const signals = [AbortSignal.timeout(timeoutMs), init?.signal].filter(signal => signal instanceof AbortSignal);

        return fetch(input, { ...init, signal: AbortSignal.any(signals) });
      }
    });
  }
}
