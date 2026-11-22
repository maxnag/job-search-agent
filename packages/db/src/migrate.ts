import { resolve } from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDatabaseConnection } from './client.js';
import { parseDBEnv } from './env/db-env.schema.js';

/**
 * Flag that points the migration at the test database
 *
 * @type {string}
 */
const TEST_FLAG = '--test';

const env = parseDBEnv(process.env);
const isTest = process.argv.includes(TEST_FLAG);
const url = isTest ? env.DATABASE_URL_TEST : env.DATABASE_URL;

if (!url) {
  throw new Error('DB_ENV_INVALID: missing or invalid keys: DATABASE_URL_TEST');
}

const { db, pool } = createDatabaseConnection({ url, connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS });

try {
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, '../migrations'),
    migrationsSchema: 'drizzle',
    migrationsTable: '__drizzle_migrations'
  });

  console.info(`Migrations applied to the ${isTest ? 'test' : 'main'} database`);
} finally {
  await pool.end();
}
