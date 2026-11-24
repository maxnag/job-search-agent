import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { CrawlPaceEnum } from '../enums/crawl-pace.enum.js';
import { HostThrottleService } from './host-throttle.service.js';

const PAUSE_MS = 60;

const API_PAUSE_MS = 15;

describe('HostThrottleService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: HostThrottleService;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [
        HostThrottleService,
        {
          provide: ConfigService,
          useValue: createConfigMock({
            CRAWL_DELAY_MIN_MS: PAUSE_MS,
            CRAWL_DELAY_MAX_MS: PAUSE_MS,
            CRAWL_API_DELAY_MIN_MS: API_PAUSE_MS,
            CRAWL_API_DELAY_MAX_MS: API_PAUSE_MS
          })
        }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(HostThrottleService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('runs the first request to a host at once and returns its result', async () => {
    const startedAt = Date.now();

    await expect(subjectUnderTest.run('a.example.com', () => Promise.resolve('page'))).resolves.toBe('page');
    expect(Date.now() - startedAt).toBeLessThan(PAUSE_MS);
  });

  it('runs requests to one host one at a time, with the pause after the previous one finished', async () => {
    const events: string[] = [];
    const finished: number[] = [];
    const started: number[] = [];
    const request = (name: string) => async () => {
      started.push(Date.now());
      events.push(`start ${name}`);
      await new Promise(resolve => setTimeout(resolve, 10));
      events.push(`end ${name}`);
      finished.push(Date.now());
    };

    await Promise.all([subjectUnderTest.run('a.example.com', request('one')), subjectUnderTest.run('a.example.com', request('two'))]);

    expect(events).toEqual(['start one', 'end one', 'start two', 'end two']);
    expect((started[1] ?? 0) - (finished[0] ?? 0)).toBeGreaterThanOrEqual(PAUSE_MS - 5);
  });

  it('does not make one host wait for another', async () => {
    await subjectUnderTest.run('a.example.com', () => Promise.resolve());

    const startedAt = Date.now();

    await subjectUnderTest.run('b.example.com', () => Promise.resolve());
    expect(Date.now() - startedAt).toBeLessThan(PAUSE_MS);
  });

  it('passes a failure to its caller and still lets the next request run after the pause', async () => {
    const failed = subjectUnderTest.run('a.example.com', () => Promise.reject(new Error('timeout')));
    const next = subjectUnderTest.run('a.example.com', () => Promise.resolve('next'));

    await expect(failed).rejects.toThrow('timeout');
    await expect(next).resolves.toBe('next');
  });

  it('waits the short pause of the API pace before a request to a job-board API', async () => {
    await subjectUnderTest.run('api.example.com', () => Promise.resolve(), CrawlPaceEnum.API);

    const startedAt = Date.now();

    await subjectUnderTest.run('api.example.com', () => Promise.resolve(), CrawlPaceEnum.API);

    const waited = Date.now() - startedAt;

    expect(waited).toBeGreaterThanOrEqual(API_PAUSE_MS - 5);
    expect(waited).toBeLessThan(PAUSE_MS);
  });

  it('keeps the long pause of the site pace when no pace is given', async () => {
    await subjectUnderTest.run('a.example.com', () => Promise.resolve(), CrawlPaceEnum.API);

    const startedAt = Date.now();

    await subjectUnderTest.run('a.example.com', () => Promise.resolve());

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(PAUSE_MS - 5);
  });
});
