import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseSchemaAnswer } from './schema-answer.helper.js';

const schema = z.object({ title: z.string(), years: z.number() });

describe('parseSchemaAnswer', () => {
  it('returns the answer typed by the schema', () => {
    expect(parseSchemaAnswer(schema, '{"title":"Developer","years":5}')).toEqual({ title: 'Developer', years: 5 });
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseSchemaAnswer(schema, 'Sure! Here is the JSON')).toThrow('LLM_OUTPUT_SCHEMA_INVALID: the answer is not JSON');
  });

  it('rejects JSON of another shape', () => {
    expect(() => parseSchemaAnswer(schema, '{"title":"Developer"}')).toThrow(
      'LLM_OUTPUT_SCHEMA_INVALID: the answer does not match the schema'
    );
  });

  it('keeps the validation error as the cause', () => {
    const error = ((): unknown => {
      try {
        return parseSchemaAnswer(schema, '{"title":1,"years":1}');
      } catch (thrown) {
        return thrown;
      }
    })();

    expect((error as Error).cause).toBeInstanceOf(z.ZodError);
  });
});
