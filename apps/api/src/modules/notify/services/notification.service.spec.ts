import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { SourceCandidateRepository } from '../../discovery/repositories/source-candidate.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import type { IMatchCard, IVacancyNotice } from '../interfaces/vacancy-notice.interface.js';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { NotificationService } from './notification.service.js';
import { TelegramService } from './telegram.service.js';

const NOTICE: IVacancyNotice = {
  vacancyId: 7,
  title: 'Backend Developer',
  company: 'Northwind',
  city: null,
  country: 'IL',
  workMode: null,
  url: 'https://careers.example.com/jobs/7',
  stage: VacancyStageEnum.EXTRACTED,
  verdict: VacancyMatchVerdictEnum.FIT,
  reasons: []
};

const CARD: IMatchCard = { ...NOTICE, vacancyMatchId: 31, notifiedAt: null, isCurrentResume: true };

describe('NotificationService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: NotificationService;
  let telegram: DeepMocked<TelegramService>;
  let events: DeepMocked<PipelineEventsService>;
  let notifications: DeepMocked<NotificationRepository>;

  beforeEach(async () => {
    telegram = createMock<TelegramService>({ isConfigured: true });
    events = createMock<PipelineEventsService>();
    notifications = createMock<NotificationRepository>();
    telegram.send.mockResolvedValue(555);
    moduleFixture = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: TelegramService, useValue: telegram },
        { provide: PipelineEventsService, useValue: events },
        { provide: NotificationRepository, useValue: notifications },
        { provide: SourceCandidateRepository, useValue: {} }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(NotificationService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  /**
   * Rebuild the service with Telegram not configured
   *
   * @returns {Promise<void>}
   */
  async function withoutTelegram(): Promise<void> {
    await moduleFixture.close();
    moduleFixture = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: TelegramService, useValue: createMock<TelegramService>({ isConfigured: false }) },
        { provide: PipelineEventsService, useValue: events },
        { provide: NotificationRepository, useValue: notifications },
        { provide: SourceCandidateRepository, useValue: {} }
      ]
    }).compile();
    subjectUnderTest = moduleFixture.get(NotificationService);
  }

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('sendMatch', () => {
    it('sends the card with the buttons and marks the match as told', async () => {
      notifications.findMatchCard.mockResolvedValue(CARD);

      await expect(subjectUnderTest.sendMatch(31)).resolves.toBe(true);

      const [html, keyboard] = telegram.send.mock.calls[0] ?? [];

      expect(html).toContain('<b>Backend Developer</b>');
      expect(keyboard?.inline_keyboard.flat()).toHaveLength(3);
      expect(notifications.markNotified).toHaveBeenCalledWith(31);
    });

    it.each([
      ['already told', { notifiedAt: new Date() }],
      ['of an older resume', { isCurrentResume: false }],
      ['of a vacancy no longer extracted', { stage: VacancyStageEnum.CLOSED }],
      ['with a no fit verdict', { verdict: VacancyMatchVerdictEnum.NO_FIT }]
    ])('sends nothing for a match %s', async (_case, changes: Partial<IMatchCard>) => {
      notifications.findMatchCard.mockResolvedValue({ ...CARD, ...changes });

      await expect(subjectUnderTest.sendMatch(31)).resolves.toBe(false);
      expect(telegram.send).not.toHaveBeenCalled();
      expect(notifications.markNotified).not.toHaveBeenCalled();
    });

    it('sends an almost verdict too', async () => {
      notifications.findMatchCard.mockResolvedValue({ ...CARD, verdict: VacancyMatchVerdictEnum.ALMOST });

      await expect(subjectUnderTest.sendMatch(31)).resolves.toBe(true);
    });

    it('refuses an unknown match', async () => {
      notifications.findMatchCard.mockResolvedValue(undefined);

      await expect(subjectUnderTest.sendMatch(31)).rejects.toThrow('VACANCY_MATCH_NOT_FOUND: 31');
    });

    it('does not mark a match told when Telegram failed', async () => {
      notifications.findMatchCard.mockResolvedValue(CARD);
      telegram.send.mockRejectedValue(new Error('Network request failed'));

      await expect(subjectUnderTest.sendMatch(31)).rejects.toThrow('Network request failed');
      expect(notifications.markNotified).not.toHaveBeenCalled();
    });
  });

  describe('notices', () => {
    it('sends a closed notice without buttons', async () => {
      notifications.findVacancyNotice.mockResolvedValue(NOTICE);

      await expect(subjectUnderTest.sendClosed(7)).resolves.toBe(true);
      expect(telegram.send).toHaveBeenCalledWith(expect.stringMatching(/^❌ Closed/));
      expect(telegram.send.mock.calls[0]).toHaveLength(1);
    });

    it('sends a changed notice with the buttons', async () => {
      notifications.findVacancyNotice.mockResolvedValue(NOTICE);

      await expect(subjectUnderTest.sendChanged(7)).resolves.toBe(true);
      expect(telegram.send.mock.calls[0]?.[0]).toMatch(/^✏️ Changed/);
      expect(telegram.send.mock.calls[0]?.[1]).toBeDefined();
    });

    it('sends a stopped source notice', async () => {
      notifications.findSourceNotice.mockResolvedValue({
        name: 'Northwind',
        url: 'https://careers.example.com',
        status: 'blocked',
        error: null
      });

      await expect(subjectUnderTest.sendSourceBlocked(1)).resolves.toBe(true);
      expect(telegram.send).toHaveBeenCalledWith(expect.stringMatching(/^⛔ Source stopped/));
    });

    it('sends nothing for a vacancy or source that is gone', async () => {
      notifications.findVacancyNotice.mockResolvedValue(undefined);
      notifications.findSourceNotice.mockResolvedValue(undefined);

      await expect(subjectUnderTest.sendClosed(7)).resolves.toBe(false);
      await expect(subjectUnderTest.sendChanged(7)).resolves.toBe(false);
      await expect(subjectUnderTest.sendSourceBlocked(1)).resolves.toBe(false);
      expect(telegram.send).not.toHaveBeenCalled();
    });
  });

  describe('queuePending', () => {
    it('queues the cards that were never sent', async () => {
      notifications.findPendingMatchIds.mockResolvedValue([31, 32]);

      await expect(subjectUnderTest.queuePending()).resolves.toBe(2);
      expect(events.vacanciesMatched).toHaveBeenCalledWith([31, 32]);
    });

    it('queues nothing when nothing is pending', async () => {
      notifications.findPendingMatchIds.mockResolvedValue([]);

      await expect(subjectUnderTest.queuePending()).resolves.toBe(0);
    });
  });

  describe('without Telegram', () => {
    it('quietly sends and queues nothing, leaving the cards for later', async () => {
      await withoutTelegram();

      await expect(subjectUnderTest.sendMatch(31)).resolves.toBe(false);
      await expect(subjectUnderTest.sendClosed(7)).resolves.toBe(false);
      await expect(subjectUnderTest.sendChanged(7)).resolves.toBe(false);
      await expect(subjectUnderTest.sendSourceBlocked(1)).resolves.toBe(false);
      await expect(subjectUnderTest.queuePending()).resolves.toBe(0);
      expect(notifications.findMatchCard).not.toHaveBeenCalled();
      expect(notifications.findPendingMatchIds).not.toHaveBeenCalled();
    });
  });
});
