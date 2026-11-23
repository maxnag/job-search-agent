import { z } from 'zod';

/**
 * Output budget every Anthropic request needs
 *
 * @returns {z.ZodNumber}
 */
function maxTokens() {
  return z.number().int().positive();
}

/**
 * Request parameters of an Anthropic step under the API's own names: `max_tokens` and thinking — off, or adaptive
 * with an effort level. The Messages API has no temperature, `top_p` or `top_k`
 */
export const anthropicParamsSchema = z.discriminatedUnion('thinking', [
  z.object({ max_tokens: maxTokens(), thinking: z.literal('disabled') }).strict(),
  z
    .object({
      max_tokens: maxTokens(),
      thinking: z.literal('adaptive'),
      effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional()
    })
    .strict()
]);

/**
 * Validated Anthropic parameters of a step
 */
export type AnthropicParamsType = z.infer<typeof anthropicParamsSchema>;
