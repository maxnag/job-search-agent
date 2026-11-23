import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { RedisService } from './redis.service.js';

const redis = vi.hoisted(() => ({ ping: vi.fn(), quit: vi.fn(), on: vi.fn(), options: vi.fn() }));

vi.mock('ioredis', () => ({
  Redis: class {
    ping = redis.ping;
    quit = redis.quit;
    on = redis.on;

    constructor(options: unknown) {
      redis.options(options);
    }
  }
}));

describe('RedisService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: RedisService;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleFixture = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: createConfigMock({ REDIS_HOST: 'localhost', REDIS_PORT: 6380, HEALTH_CHECK_TIMEOUT_MS: 3000 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(RedisService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('connects with the configured host, port and timeout', () => {
    expect(redis.options).toHaveBeenCalledWith({ host: 'localhost', port: 6380, connectTimeout: 3000, maxRetriesPerRequest: 1 });
  });

  it('pings Redis', async () => {
    await subjectUnderTest.ping();

    expect(redis.ping).toHaveBeenCalled();
  });

  it('logs a connection error as a warning instead of crashing', () => {
    const handler = redis.on.mock.calls.find(([event]) => event === 'error')?.[1] as (error: Error) => void;

    expect(() => handler(new Error('ECONNREFUSED'))).not.toThrow();
  });

  it('quits on shutdown', async () => {
    await subjectUnderTest.onApplicationShutdown();

    expect(redis.quit).toHaveBeenCalled();
  });
});
