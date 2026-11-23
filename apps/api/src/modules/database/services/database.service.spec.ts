import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { DatabaseService } from './database.service.js';

const connection = vi.hoisted(() => ({ db: { execute: vi.fn() }, pool: { end: vi.fn() } }));
const createDatabaseConnection = vi.hoisted(() => vi.fn(() => connection));

vi.mock('@job-agent/db', () => ({ createDatabaseConnection }));

describe('DatabaseService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: DatabaseService;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleFixture = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: createConfigMock({ DATABASE_URL: 'postgres://localhost/db', DATABASE_CONNECTION_TIMEOUT_MS: 5000 })
        }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(DatabaseService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('opens one pool from the configuration', () => {
    expect(createDatabaseConnection).toHaveBeenCalledWith({ url: 'postgres://localhost/db', connectionTimeoutMs: 5000 });
  });

  it('pings with one query', async () => {
    await subjectUnderTest.ping();

    expect(connection.db.execute).toHaveBeenCalledTimes(1);
  });

  it('closes the pool on shutdown', async () => {
    await subjectUnderTest.onApplicationShutdown();

    expect(connection.pool.end).toHaveBeenCalled();
  });
});
