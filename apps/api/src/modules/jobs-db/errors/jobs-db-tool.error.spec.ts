import { describe, expect, it } from 'vitest';

import { JobsDBErrorCodeEnum } from '../enums/jobs-db-error-code.enum.js';
import { JobsDBToolError } from './jobs-db-tool.error.js';

describe('JobsDBToolError', () => {
  it('carries its code and the sentence for the model, both in its message', () => {
    const error = new JobsDBToolError(JobsDBErrorCodeEnum.VACANCY_NOT_FOUND, 'There is no vacancy 999');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('JobsDBToolError');
    expect(error.code).toBe(JobsDBErrorCodeEnum.VACANCY_NOT_FOUND);
    expect(error.detail).toBe('There is no vacancy 999');
    expect(error.message).toBe('VACANCY_NOT_FOUND: There is no vacancy 999');
  });
});
