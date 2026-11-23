import { z } from 'zod';

/**
 * Generation options of an Ollama step under the API's own names (`num_predict`, `temperature`, `num_ctx` …),
 * passed through as `options`
 */
export const ollamaParamsSchema = z.looseObject({
  num_predict: z.number().int().positive().optional()
});

/**
 * Validated Ollama parameters of a step
 */
export type OllamaParamsType = z.infer<typeof ollamaParamsSchema>;
