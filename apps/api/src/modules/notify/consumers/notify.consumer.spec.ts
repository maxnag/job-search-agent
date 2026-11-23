import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Job, UnrecoverableError } from 'bullmq';
import { GrammyError } from 'grammy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobNameEnum } from '@job-agent/shared';

import { NotificationService } from '../services/notification.service.js';
import { NotifyConsumer } from './notify.consumer.js';

/**
 * A notify job
 *
 * @param {JobNameEnum} name
 * @param {Record<string, number>} data
 *
 * @returns {Job<Record<string, number>, unknown, JobNameEnum>}
 */
function job(name: JobNameEnum, data: Record<string, number> = {}): Job<Record<string, number>, unknown, JobNameEnum> {
  return createMock<Job<Record<string, number>, unknown, JobNameEnum>>({ id: '1', name, data, attemptsMade: 1, opts: { attempts: 3 } });
}

/**
 * An error of the Telegram Bot API
 *
 * @param {number} code
 *
 * @returns {GrammyError}
 */
function telegramError(code: number): GrammyError {
  return new GrammyError(
    'Call to sendMessage failed',
    { ok: false, error_code: code, description: 'Bad Request: chat not found' },
    'sendMessage',
    {}
  );
}

describe('NotifyConsumer (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: NotifyConsumer;
  let notifications: DeepMocked<NotificationService>;

  beforeEach(async () => {
    notifications = createMock<NotificationService>();
    moduleFixture = await Test.createTestingModule({
      providers: [NotifyConsumer, { provide: NotificationService, useValue: notifications }]
    }).compile();

    subjectUnderTest = moduleFixture.get(NotifyConsumer);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('process', () => {
    it('sends a match card', async () => {
      notifications.sendMatch.mockResolvedValue(true);

      await expect(subjectUnderTest.process(job(JobNameEnum.VACANCY_MATCHED, { vacancyMatchId: 31 }))).resolves.toBe(true);
      expect(notifications.sendMatch).toHaveBeenCalledWith(31);
    });

    it('sends the closed, changed and stopped source notices', async () => {
      await subjectUnderTest.process(job(JobNameEnum.VACANCY_CLOSED, { vacancyId: 7 }));
      await subjectUnderTest.process(job(JobNameEnum.VACANCY_CHANGED, { vacancyId: 8 }));
      await subjectUnderTest.process(job(JobNameEnum.SOURCE_BLOCKED, { sourceId: 1 }));

      expect(notifications.sendClosed).toHaveBeenCalledWith(7);
      expect(notifications.sendChanged).toHaveBeenCalledWith(8);
      expect(notifications.sendSourceBlocked).toHaveBeenCalledWith(1);
    });

    it('sweeps the pending cards', async () => {
      notifications.queuePending.mockResolvedValue(2);

      await expect(subjectUnderTest.process(job(JobNameEnum.NOTIFY_PENDING))).resolves.toBe(2);
    });

    it('refuses an unknown job for good', async () => {
      await expect(subjectUnderTest.process(job(JobNameEnum.SCAN_SOURCE))).rejects.toThrow(UnrecoverableError);
    });

    it.each([400, 401, 403, 404])('stops the retries when Telegram answers %i', async code => {
      notifications.sendMatch.mockRejectedValue(telegramError(code));

      await expect(subjectUnderTest.process(job(JobNameEnum.VACANCY_MATCHED, { vacancyMatchId: 31 }))).rejects.toMatchObject({
        name: 'UnrecoverableError',
        message: `TELEGRAM_REFUSED: ${code} Bad Request: chat not found`
      });
    });

    it('retries when Telegram is rate limiting or down', async () => {
      const error = telegramError(429);

      notifications.sendMatch.mockRejectedValue(error);

      await expect(subjectUnderTest.process(job(JobNameEnum.VACANCY_MATCHED, { vacancyMatchId: 31 }))).rejects.toBe(error);
    });

    it('stops the retries when Telegram is not configured', async () => {
      notifications.sendMatch.mockRejectedValue(new Error('TELEGRAM_NOT_CONFIGURED: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not set'));

      await expect(subjectUnderTest.process(job(JobNameEnum.VACANCY_MATCHED, { vacancyMatchId: 31 }))).rejects.toThrow(UnrecoverableError);
    });

    it('retries a network failure', async () => {
      notifications.sendClosed.mockRejectedValue(new Error('ECONNRESET'));

      await expect(subjectUnderTest.process(job(JobNameEnum.VACANCY_CLOSED, { vacancyId: 7 }))).rejects.not.toBeInstanceOf(
        UnrecoverableError
      );
    });
  });

  it('onFailed warns about a retry', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    subjectUnderTest.onFailed(job(JobNameEnum.VACANCY_MATCHED), new Error('timeout'));

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Job will be retried', reason: 'timeout' }));
  });

  it('onCompleted logs the job at debug level', () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    subjectUnderTest.onCompleted(job(JobNameEnum.VACANCY_MATCHED));

    expect(debug).toHaveBeenCalledWith({ message: 'Notify job completed', job: JobNameEnum.VACANCY_MATCHED, jobId: '1' });
  });
});
