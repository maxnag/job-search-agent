import type { z } from 'zod';

/**
 * Parse the text of an LLM answer as JSON and validate it — even when the provider promises structured output
 *
 * @param {z.ZodType<TOutput>} schema
 * @param {string} text
 *
 * @template TOutput
 *
 * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the text is not JSON or does not match the schema
 *
 * @returns {TOutput}
 */
export function parseSchemaAnswer<TOutput>(schema: z.ZodType<TOutput>, text: string): TOutput {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error('LLM_OUTPUT_SCHEMA_INVALID: the answer is not JSON', { cause: error });
  }

  const result = schema.safeParse(json);

  if (!result.success) {
    throw new Error('LLM_OUTPUT_SCHEMA_INVALID: the answer does not match the schema', { cause: result.error });
  }

  return result.data;
}
