import { describe, expect, it } from 'vitest';

import { parseDBEnv } from './db-env.schema.js';

describe('parseDBEnv', () => {
  it('accepts a database URL and fills the defaults', () => {
    expect(parseDBEnv({ DATABASE_URL: 'postgres://user:password@localhost:5433/db' })).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://user:password@localhost:5433/db',
      DATABASE_CONNECTION_TIMEOUT_MS: 5000
    });
  });

  it('names the invalid keys', () => {
    expect(() => parseDBEnv({ DATABASE_URL: 'not a url', NODE_ENV: 'staging' })).toThrow(
      'DB_ENV_INVALID: missing or invalid keys: NODE_ENV, DATABASE_URL'
    );
  });

  it('requires the database URL', () => {
    expect(() => parseDBEnv({})).toThrow('DATABASE_URL');
  });
});
