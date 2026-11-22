import type { ILLMClient, ILLMHealth, IStructuredRequest } from '../interfaces/l-l-m-client.interface.js';

/**
 * Injection token of the LLM port; the module binds it to the adapter chosen by `LLM_PROVIDER`
 */
export abstract class LLMClient implements ILLMClient {
  /**
   * Ask for an answer and return it validated against the request schema
   *
   * @param {IStructuredRequest<TOutput>} request
   *
   * @template TOutput
   *
   * @returns {Promise<TOutput>}
   */
  abstract generateStructured<TOutput>(request: IStructuredRequest<TOutput>): Promise<TOutput>;

  /**
   * Check the provider without spending tokens
   *
   * @param {number} timeoutMs
   *
   * @returns {Promise<ILLMHealth>}
   */
  abstract checkHealth(timeoutMs: number): Promise<ILLMHealth>;
}
