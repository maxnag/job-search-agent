import { describe, expect, it } from 'vitest';

import { APIClientError } from './a-p-i-client.error';
import { APIErrorCodeEnum } from './a-p-i-error-code.enum';

describe('APIClientError', () => {
  it('keeps the code, the message and the cause, and names itself', () => {
    const cause = new TypeError('fetch failed');
    const error = new APIClientError(APIErrorCodeEnum.API_UNAVAILABLE, 'The API is not reachable for /health', cause);

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(APIErrorCodeEnum.API_UNAVAILABLE);
    expect(error.message).toBe('The API is not reachable for /health');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('APIClientError');
  });
});
