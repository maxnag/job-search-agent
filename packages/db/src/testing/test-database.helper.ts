import { getTableName, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

import { createDatabaseConnection } from '../client.js';
import type { DatabaseExecutor, IDatabaseConnection } from '../interfaces/database-connection.interface.js';

/**
 * Suffix every database an e2e test may write to ends with
 *
 * @type {string}
 */
export const TEST_DATABASE_SUFFIX = '_test';

/**
 * How long an e2e test waits for a connection from the pool
 *
 * @type {number}
 */
const TEST_CONNECTION_TIMEOUT_MS = 5000;

/**
 * Guard of every e2e test that writes or cleans tables: the connection string must name a `*_test` database
 *
 * @param {string | undefined} url
 *
 * @throws {Error} `E2E_DATABASE_NOT_TEST` if the URL is missing, invalid or names another database
 *
 * @returns {string} The URL, proven to name a test database
 */
export function assertTestDatabaseURL(url: string | undefined): string {
  const databaseName = URL.canParse(url ?? '') ? new URL(url ?? '').pathname.slice(1) : '';

  if (!databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(`E2E_DATABASE_NOT_TEST: the database name must end with ${TEST_DATABASE_SUFFIX}`);
  }

  return url ?? '';
}

/**
 * Open a connection to the test database, after the guard
 *
 * @param {string | undefined} url
 *
 * @throws {Error} `E2E_DATABASE_NOT_TEST` if the URL does not name a test database
 *
 * @returns {IDatabaseConnection}
 */
export function openTestDatabase(url: string | undefined): IDatabaseConnection {
  return createDatabaseConnection({ url: assertTestDatabaseURL(url), connectionTimeoutMs: TEST_CONNECTION_TIMEOUT_MS });
}

/**
 * Empty the tables and the tables that reference them, resetting their identities
 *
 * @param {DatabaseExecutor} db
 * @param {readonly PgTable[]} tables
 *
 * @returns {Promise<void>}
 */
export async function truncateTables(db: DatabaseExecutor, tables: readonly PgTable[]): Promise<void> {
  if (tables.length === 0) {
    return;
  }

  const names = sql.join(
    tables.map(table => sql.identifier(getTableName(table))),
    sql`, `
  );

  await db.execute(sql`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}
