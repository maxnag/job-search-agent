import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseATSResponse, validItems, validateATSResponse } from './a-t-s-response.helper.js';

/**
 * A small response schema
 *
 * @type {z.ZodObject}
 */
const schema = z.object({ id: z.number() });

describe('validateATSResponse', () => {
  it('returns the parsed value', () => {
    expect(validateATSResponse({ id: 7, extra: true }, schema, 'Board')).toEqual({ id: 7 });
  });

  it('throws ATS_RESPONSE_INVALID with the schema error as cause', () => {
    let caught: unknown;

    try {
      validateATSResponse({ id: 'seven' }, schema, 'Board');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('ATS_RESPONSE_INVALID: Board does not match the schema');
    expect((caught as Error).cause).toBeInstanceOf(z.ZodError);
  });
});

describe('parseATSResponse', () => {
  it('parses and validates a JSON body', () => {
    expect(parseATSResponse('{"id":3}', schema, 'Board')).toEqual({ id: 3 });
  });

  it('throws ATS_RESPONSE_INVALID for a body that is not JSON', () => {
    expect(() => parseATSResponse('<html>', schema, 'Board')).toThrow('ATS_RESPONSE_INVALID: Board is not JSON');
  });

  it('throws ATS_RESPONSE_INVALID for JSON of another shape', () => {
    expect(() => parseATSResponse('[]', schema, 'Board')).toThrow('ATS_RESPONSE_INVALID: Board does not match the schema');
  });
});

describe('validItems', () => {
  it('keeps the valid items and counts the dropped ones', () => {
    expect(validItems([{ id: 1 }, { id: 'x' }, null, { id: 2 }], schema)).toEqual({ valid: [{ id: 1 }, { id: 2 }], dropped: 2 });
  });

  it('gives nothing for no items', () => {
    expect(validItems([], schema)).toEqual({ valid: [], dropped: 0 });
  });
});
