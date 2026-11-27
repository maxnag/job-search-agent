import { z } from 'zod';

/**
 * Parameters of an Ollama step under the API's own names: `think` (required — `false` or a level) and `keep_alive`
 * (how long the model stays loaded after the answer; the server default when absent) go to the request itself, and
 * every other key (`num_predict`, `temperature`, `num_ctx` …) is passed through as `options`
 */
export const ollamaParamsSchema = z.looseObject({
  think: z.union([z.boolean(), z.enum(['low', 'medium', 'high'])]),
  keep_alive: z.union([z.string().min(1), z.number().int()]).optional(),
  num_predict: z.number().int().positive().optional()
});

/**
 * Validated Ollama parameters of a step
 */
export type OllamaParamsType = z.infer<typeof ollamaParamsSchema>;
