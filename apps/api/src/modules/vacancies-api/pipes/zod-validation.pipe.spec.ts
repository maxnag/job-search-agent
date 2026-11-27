import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe (unit)', () => {
  const subjectUnderTest = new ZodValidationPipe(z.object({ page: z.coerce.number().int().positive(), kind: z.enum(['a', 'b']) }));

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('hands the parsed value on', () => {
    expect(subjectUnderTest.transform({ page: '2', kind: 'a' })).toEqual({ page: 2, kind: 'a' });
  });

  it('refuses a wrong value with REQUEST_INVALID and the paths of the wrong fields', () => {
    let caught: unknown;

    try {
      subjectUnderTest.transform({ page: '0', kind: 'c' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual({
      code: 'REQUEST_INVALID',
      message: 'The request is invalid',
      fields: ['page', 'kind']
    });
  });
});
