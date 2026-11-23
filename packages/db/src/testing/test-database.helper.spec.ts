import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseExecutor } from '../interfaces/database-connection.interface.js';
import { llmSettings } from '../schema/llm-settings.table.js';
import { profiles } from '../schema/profiles.table.js';
import { TEST_DATABASE_SUFFIX, assertTestDatabaseURL, openTestDatabase, truncateTables } from './test-database.helper.js';

describe('assertTestDatabaseURL', () => {
  it('passes a URL that names a *_test database', () => {
    const url = 'postgres://user:secret@localhost:5433/job_agent_test';

    expect(assertTestDatabaseURL(url)).toBe(url);
  });

  it.each([
    ['the dev database', 'postgres://user:secret@localhost:5433/job_agent'],
    ['a name with the suffix inside', 'postgres://user:secret@localhost:5433/job_agent_test_copy'],
    ['no database name', 'postgres://user:secret@localhost:5433'],
    ['an invalid URL', 'job_agent_test'],
    ['an empty value', ''],
    ['a missing value', undefined]
  ])('throws for %s', (_case, url) => {
    expect(() => assertTestDatabaseURL(url)).toThrow(`E2E_DATABASE_NOT_TEST: the database name must end with ${TEST_DATABASE_SUFFIX}`);
  });
});

describe('openTestDatabase', () => {
  it('refuses a database that is not a test one before connecting', () => {
    expect(() => openTestDatabase('postgres://user:secret@localhost:5433/job_agent')).toThrow('E2E_DATABASE_NOT_TEST');
  });

  it('opens a pool for a test database without querying it', async () => {
    const connection = openTestDatabase('postgres://user:secret@localhost:5433/job_agent_test');

    expect(connection.db).toBeDefined();

    await connection.pool.end();
  });
});

describe('truncateTables', () => {
  it('truncates every table in one statement, resetting identities and cascading', async () => {
    const execute = vi.fn(async () => Promise.resolve());
    const db = { execute } as unknown as DatabaseExecutor;

    await truncateTables(db, [profiles, llmSettings]);

    const [[statement]] = execute.mock.calls as unknown as [[Parameters<PgDialect['sqlToQuery']>[0]]];

    expect(new PgDialect().sqlToQuery(statement).sql).toBe('TRUNCATE "profiles", "llm_settings" RESTART IDENTITY CASCADE');
  });

  it('runs nothing for an empty list', async () => {
    const execute = vi.fn(async () => Promise.resolve());

    await truncateTables({ execute } as unknown as DatabaseExecutor, []);

    expect(execute).not.toHaveBeenCalled();
  });
});
