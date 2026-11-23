import type { Provider } from '@nestjs/common';

import { assertTestDatabaseURL } from '@job-agent/db';

import { DatabaseService } from '../src/modules/database/services/database.service.js';
import { createConfigMock } from './config-service.mock.js';

/**
 * How long an e2e test waits for a connection from the pool
 *
 * @type {number}
 */
const TEST_CONNECTION_TIMEOUT_MS = 5000;

/**
 * A real `DatabaseService` bound to the test database — the guard runs before the pool is created, and the pool is
 * closed by `moduleFixture.close()`
 *
 * @returns {Provider}
 */
export function testDatabaseProvider(): Provider {
  return {
    provide: DatabaseService,
    useFactory: () =>
      new DatabaseService(
        createConfigMock({
          DATABASE_URL: assertTestDatabaseURL(process.env.DATABASE_URL_TEST),
          DATABASE_CONNECTION_TIMEOUT_MS: TEST_CONNECTION_TIMEOUT_MS
        })
      )
  };
}
