import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ATSKindEnum,
  SourceCandidateStatusEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancyStageEnum
} from '@job-agent/shared';

import type { SourceCandidateRowType } from '../../discovery/interfaces/source-candidate-row.interface.js';
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
  textURL: null,
  stage: VacancyStageEnum.EXTRACTED,
  verdict: VacancyMatchVerdictEnum.FIT,
  reasons: []
};

const CARD: IMatchCard = { ...NOTICE, vacancyMatchId: 31, notifiedAt: null, isCurrentResume: true };

const CANDIDATE = {
  source_candidate_id: 5,
  source_candidate_ats_kind: ATSKindEnum.GREENHOUSE,
  source_candidate_board: 'northwind',
  source_candidate_company: 'Northwind',
  source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
  source_candidate_positions: 9,
  source_candidate_matching: 2,
  source_candidate_unknown: 0,
  source_candidate_examples: ['Backend Developer — Haifa']
} as SourceCandidateRowType;

describe('NotificationService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: NotificationService;
  let telegram: DeepMocked<TelegramService>;
  let events: DeepMocked<PipelineEventsService>;
  let notifications: DeepMocked<NotificationRepository>;
  let candidates: DeepMocked<SourceCandidateRepository>;

  beforeEach(async () => {
    telegram = createMock<TelegramService>({ isConfigured: true });
    events = createMock<PipelineEventsService>();
    notifications = createMock<NotificationRepository>();
    candidates = createMock<SourceCandidateRepository>();
    telegram.send.mockResolvedValue(555);
    telegram.editKeyboard.mockResolvedValue(true);
    notifications.findUnsyncedActions.mockResolvedValue([]);
    moduleFixture = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: TelegramService, useValue: telegram },
        { provide: PipelineEventsService, useValue: events },
        { provide: NotificationRepository, useValue: notifications },
        { provide: SourceCandidateRepository, useValue: candidates }
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
        { provide: SourceCandidateRepository, useValue: candidates }
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

    it('remembers the message of the card as one that carries the buttons of the vacancy', async () => {
      notifications.findMatchCard.mockResolvedValue(CARD);

      await subjectUnderTest.sendMatch(31);

      expect(notifications.createMessage).toHaveBeenCalledWith(7, 555);
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
      expect(notifications.createMessage).toHaveBeenCalledWith(7, 555);
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

    it('sends the notice of a mailbox that refused the password', async () => {
      await expect(subjectUnderTest.sendJobMailDisabled()).resolves.toBe(true);
      expect(telegram.send).toHaveBeenCalledWith(expect.stringMatching(/^📭 Job mail is off/));
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

    it('shows the choices not synced yet under every vacancy', async () => {
      notifications.findPendingMatchIds.mockResolvedValue([]);

      await subjectUnderTest.queuePending();

      expect(notifications.findUnsyncedActions).toHaveBeenCalledWith(undefined);
    });
  });

  describe('syncActions', () => {
    const ACTION = { vacancyId: 7, vacancyActionId: 40, kind: VacancyActionKindEnum.APPLIED };

    /**
     * Labels of the buttons an edit put under a message
     *
     * @param {number} call
     *
     * @returns {string[]}
     */
    function labels(call: number): string[] {
      return (telegram.editKeyboard.mock.calls[call]?.[1]?.inline_keyboard.flat() ?? []).map(button => button.text);
    }

    it('ticks the latest choice under every message of the vacancy and marks it synced', async () => {
      notifications.findUnsyncedActions.mockResolvedValue([ACTION]);
      notifications.findMessageIds.mockResolvedValue([555, 556]);

      await expect(subjectUnderTest.syncActions(7)).resolves.toBe(1);

      expect(notifications.findUnsyncedActions).toHaveBeenCalledWith(7);
      expect(telegram.editKeyboard.mock.calls.map(call => call[0])).toEqual([555, 556]);
      expect(labels(0)).toEqual(['Interested', 'Skip', '✓ Applied']);
      expect(notifications.markActionsSynced).toHaveBeenCalledWith(7, 40);
    });

    it('forgets a message the chat no longer has and still marks the choice synced', async () => {
      notifications.findUnsyncedActions.mockResolvedValue([ACTION]);
      notifications.findMessageIds.mockResolvedValue([555, 556]);
      telegram.editKeyboard.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await subjectUnderTest.syncActions(7);

      expect(notifications.deleteMessage).toHaveBeenCalledWith(7, 555);
      expect(notifications.deleteMessage).toHaveBeenCalledTimes(1);
      expect(notifications.markActionsSynced).toHaveBeenCalledWith(7, 40);
    });

    it('marks a choice of a vacancy without messages synced, editing nothing', async () => {
      notifications.findUnsyncedActions.mockResolvedValue([ACTION]);
      notifications.findMessageIds.mockResolvedValue([]);

      await subjectUnderTest.syncActions();

      expect(telegram.editKeyboard).not.toHaveBeenCalled();
      expect(notifications.markActionsSynced).toHaveBeenCalledWith(7, 40);
    });

    it('leaves the choice unsynced when Telegram refuses, for the next sweep', async () => {
      notifications.findUnsyncedActions.mockResolvedValue([ACTION]);
      notifications.findMessageIds.mockResolvedValue([555]);
      telegram.editKeyboard.mockRejectedValue(new Error('Network request failed'));

      await expect(subjectUnderTest.syncActions(7)).rejects.toThrow('Network request failed');
      expect(notifications.markActionsSynced).not.toHaveBeenCalled();
    });

    it('syncs nothing when nothing waits', async () => {
      await expect(subjectUnderTest.syncActions()).resolves.toBe(0);
      expect(telegram.editKeyboard).not.toHaveBeenCalled();
    });
  });

  describe('sendSourceCandidate', () => {
    it('sends the card of a proposed candidate with both decisions', async () => {
      candidates.findOne.mockResolvedValue(CANDIDATE);

      await expect(subjectUnderTest.sendSourceCandidate(5)).resolves.toBe(true);

      const [html, keyboard] = telegram.send.mock.calls[0] ?? [];

      expect(html).toContain('<b>Northwind</b> (Greenhouse)');
      expect(keyboard?.inline_keyboard.flat().map(button => button.text)).toEqual(['Add as a source', 'Ignore']);
    });

    it.each([SourceCandidateStatusEnum.ADDED, SourceCandidateStatusEnum.IGNORED, SourceCandidateStatusEnum.EMPTY])(
      'sends nothing for a candidate already %s',
      async status => {
        candidates.findOne.mockResolvedValue({ ...CANDIDATE, source_candidate_status: status });

        await expect(subjectUnderTest.sendSourceCandidate(5)).resolves.toBe(false);
        expect(telegram.send).not.toHaveBeenCalled();
      }
    );

    it('sends nothing for a candidate that is gone', async () => {
      candidates.findOne.mockResolvedValue(undefined);

      await expect(subjectUnderTest.sendSourceCandidate(5)).resolves.toBe(false);
      expect(telegram.send).not.toHaveBeenCalled();
    });
  });

  describe('without Telegram', () => {
    it('quietly sends and queues nothing, leaving the cards for later', async () => {
      await withoutTelegram();

      await expect(subjectUnderTest.sendMatch(31)).resolves.toBe(false);
      await expect(subjectUnderTest.sendClosed(7)).resolves.toBe(false);
      await expect(subjectUnderTest.sendChanged(7)).resolves.toBe(false);
      await expect(subjectUnderTest.sendSourceBlocked(1)).resolves.toBe(false);
      await expect(subjectUnderTest.sendSourceCandidate(5)).resolves.toBe(false);
      await expect(subjectUnderTest.sendJobMailDisabled()).resolves.toBe(false);
      await expect(subjectUnderTest.queuePending()).resolves.toBe(0);
      await expect(subjectUnderTest.syncActions(7)).resolves.toBe(0);
      expect(candidates.findOne).not.toHaveBeenCalled();
      expect(notifications.findMatchCard).not.toHaveBeenCalled();
      expect(notifications.findPendingMatchIds).not.toHaveBeenCalled();
      expect(notifications.findUnsyncedActions).not.toHaveBeenCalled();
    });
  });
});
