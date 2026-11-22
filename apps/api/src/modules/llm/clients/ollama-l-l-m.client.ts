import { Logger } from '@nestjs/common';
import { Ollama } from 'ollama';
import { z } from 'zod';

import { LLMProviderEnum } from '../enums/l-l-m-provider.enum.js';
import { parseStructuredOutput } from '../helpers/structured-output.helper.js';
import type { ILLMHealth, IStructuredRequest } from '../interfaces/l-l-m-client.interface.js';
import type { LLMModelService } from '../services/l-l-m-model.service.js';
import { LLMClient } from './l-l-m.client.js';

/**
 * Tag Ollama adds to a model pulled without one
 *
 * @type {string}
 */
const DEFAULT_TAG = ':latest';

/**
 * Settings of the Ollama adapter
 */
export interface IOllamaLLMClientOptions {
  /**
   * Ollama server URL
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Timeout of one generation request
   *
   * @var {number}
   */
  readonly timeoutMs: number;
}

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
   * @param {LLMModelService} llmModelService
   */
  constructor(
    options: IOllamaLLMClientOptions,
    private readonly llmModelService: LLMModelService
  ) {
    super();
    this.url = options.url;
    this.timeoutMs = options.timeoutMs;
  }

  /**
   * Ask the step model for an answer constrained by the request schema and validate it
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
    const messages = request.system ? [{ role: 'system', content: request.system }] : [];
    const response = await this.createClient(this.timeoutMs).chat({
      model: this.llmModelService.resolve(request.step),
      messages: [...messages, { role: 'user', content: request.prompt }],
      format: z.toJSONSchema(request.schema),
      options: { num_predict: request.maxTokens },
      stream: false
    });

    return parseStructuredOutput(request.schema, response.message.content);
  }

  /**
   * List the local models and check that every configured one is pulled
   *
   * @param {number} timeoutMs
   *
   * @returns {Promise<ILLMHealth>}
   */
  async checkHealth(timeoutMs: number): Promise<ILLMHealth> {
    const models = this.llmModelService.findAll();

    try {
      const { models: pulled } = await this.createClient(timeoutMs).list();
      const names = new Set(pulled.map(model => model.name));
      const missingModels = models.filter(model => !names.has(model) && !names.has(`${model}${DEFAULT_TAG}`));

      return { provider: LLMProviderEnum.OLLAMA, up: missingModels.length === 0, missingModels };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';

      this.logger.debug({ message: 'Ollama health check failed', reason });

      return { provider: LLMProviderEnum.OLLAMA, up: false, missingModels: models, reason };
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
