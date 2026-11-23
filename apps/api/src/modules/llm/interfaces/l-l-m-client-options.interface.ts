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
