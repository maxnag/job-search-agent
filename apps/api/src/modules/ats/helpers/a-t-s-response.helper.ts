import type { z } from 'zod';

/**
 * A value of a board answer checked against its schema
 *
 * @param {unknown} value
 * @param {z.ZodType<TOutput>} schema
 * @param {string} what
 *
 * @template TOutput
 *
 * @throws {Error} `ATS_RESPONSE_INVALID` if the value does not match the schema
 *
 * @returns {TOutput}
 */
export function validateATSResponse<TOutput>(value: unknown, schema: z.ZodType<TOutput>, what: string): TOutput {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new Error(`ATS_RESPONSE_INVALID: ${what} does not match the schema`, { cause: result.error });
  }

  return result.data;
}

/**
 * A JSON answer of a board checked against its schema
 *
 * @param {string} body
 * @param {z.ZodType<TOutput>} schema
 * @param {string} what
 *
 * @template TOutput
 *
 * @throws {Error} `ATS_RESPONSE_INVALID` if the body is not JSON or does not match the schema
 *
 * @returns {TOutput}
 */
export function parseATSResponse<TOutput>(body: string, schema: z.ZodType<TOutput>, what: string): TOutput {
  let value: unknown;

  try {
    value = JSON.parse(body) as unknown;
  } catch (error) {
    throw new Error(`ATS_RESPONSE_INVALID: ${what} is not JSON`, { cause: error });
  }

  return validateATSResponse(value, schema, what);
}

/**
 * The items of a list that match their schema, and how many did not
 *
 * @param {readonly unknown[]} items
 * @param {z.ZodType<TOutput>} schema
 *
 * @template TOutput
 *
 * @returns {{ valid: TOutput[]; dropped: number }}
 */
export function validItems<TOutput>(items: readonly unknown[], schema: z.ZodType<TOutput>): { valid: TOutput[]; dropped: number } {
  const valid: TOutput[] = [];

  for (const item of items) {
    const result = schema.safeParse(item);

    if (result.success) {
      valid.push(result.data);
    }
  }

  return { valid, dropped: items.length - valid.length };
}
