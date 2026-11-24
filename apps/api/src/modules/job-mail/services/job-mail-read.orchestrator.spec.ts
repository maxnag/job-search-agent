import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JobMailKindEnum,
  JobMailMessageStatusEnum,
  JobMailProviderEnum,
  RoleFamilyEnum,
  SeniorityLevelEnum,
  SourceFetchModeEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import type { IListedPosition } from '../../search/interfaces/listed-position.interface.js';
import type { SourceRowType } from '../../search/interfaces/source-row.interface.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import { ListingExtractionService } from '../../search/services/listing-extraction.service.js';
import { ProfilePreferencesService } from '../../search/services/profile-preferences.service.js';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import type { IJobMailHeaders, IJobMailMessage } from '../interfaces/job-mail-message.interface.js';
import type { IJobMailProvider, IJobMailbox } from '../interfaces/job-mail-provider.interface.js';
import { JobMailMessageRepository } from '../repositories/job-mail-message.repository.js';
import { JobMailProviderRegistry } from './job-mail-provider.registry.js';
import { JobMailReadOrchestrator } from './job-mail-read.orchestrator.js';
import { JobMailTriageService } from './job-mail-triage.service.js';

/**
 * The moment the tests run at
 *
 * @type {Date}
 */
const NOW = new Date('2026-11-24T12:00:00Z');

/**
 * Body of a job alert: two vacancies, one service link
 *
 * @type {string}
 */
const ALERT_HTML =
  '<table><tr><td><a href="https://jobs.example.com/job/7?utm_source=alert">Backend Developer</a></td></tr>' +
  '<tr><td><a href="https://jobs.example.com/job/8">QA Engineer</a></td></tr>' +
  '<tr><td><a href="https://jobs.example.com/unsubscribe?t=1">Unsubscribe</a></td></tr></table>';

/**
 * Source of the sender domain of the job alerts
 *
 * @type {SourceRowType}
 */
const SOURCE = {
  source_id: 25,
  source_name: 'jobs.example.com',
  source_url: 'mailto:@jobs.example.com',
  source_fetch_mode: SourceFetchModeEnum.JOB_MAIL,
  source_is_active: true
} as SourceRowType;

/**
 * A position the LLM picked from the alert
 *
 * @type {IListedPosition}
 */
const BACKEND: IListedPosition = {
  url: 'https://jobs.example.com/job/7',
  title: 'Backend Developer',
  company: 'Northwind',
  country: 'IL',
  city: 'Haifa',
  workMode: WorkModeEnum.HYBRID,
  roleFamily: RoleFamilyEnum.BACKEND,
  level: SeniorityLevelEnum.SENIOR
};

/**
 * A position no profile searches
 *
 * @type {IListedPosition}
 */
const QA: IListedPosition = { ...BACKEND, url: 'https://jobs.example.com/job/8', title: 'QA Engineer', roleFamily: RoleFamilyEnum.QA };

/**
 * Headers of a fictional e-mail
 *
 * @param {number} uid
 * @param {Partial<IJobMailHeaders>} changes
 *
 * @returns {IJobMailHeaders}
 */
function headers(uid: number, changes: Partial<IJobMailHeaders> = {}): IJobMailHeaders {
  return {
    providerId: `7:${uid}`,
    messageKey: `<mail-${uid}@example.com>`,
    senderName: 'Northwind Careers',
    senderAddress: 'alerts@jobs.example.com',
    subject: 'Backend Developer and 1 more job',
    receivedAt: new Date(NOW.getTime() - uid * 60_000),
    ...changes
  };
}

/**
 * The e-mail with its body
 *
 * @param {IJobMailHeaders} jobMail
 * @param {string | null} html
 *
 * @returns {IJobMailMessage}
 */
function withBody(jobMail: IJobMailHeaders, html: string | null = ALERT_HTML): IJobMailMessage {
  return { ...jobMail, html, text: null };
}

describe('JobMailReadOrchestrator (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: JobMailReadOrchestrator;
  let triage: DeepMocked<JobMailTriageService>;
  let listing: DeepMocked<ListingExtractionService>;
  let preferences: DeepMocked<ProfilePreferencesService>;
  let events: DeepMocked<PipelineEventsService>;
  let jobMailMessages: DeepMocked<JobMailMessageRepository>;
  let sources: DeepMocked<SourceRepository>;
  let vacancies: DeepMocked<VacancyRepository>;
  let provider: DeepMocked<IJobMailProvider>;
  let jobMailbox: DeepMocked<IJobMailbox>;

  beforeEach(async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    triage = createMock<JobMailTriageService>();
    listing = createMock<ListingExtractionService>();
    preferences = createMock<ProfilePreferencesService>();
    events = createMock<PipelineEventsService>();
    jobMailMessages = createMock<JobMailMessageRepository>();
    sources = createMock<SourceRepository>();
    vacancies = createMock<VacancyRepository>();
    provider = createMock<IJobMailProvider>();
    jobMailbox = createMock<IJobMailbox>();

    const registry = createMock<JobMailProviderRegistry>();

    registry.findOne.mockReturnValue(provider);
    provider.isConfigured.mockReturnValue(true);
    provider.open.mockResolvedValue(jobMailbox);
    jobMailbox.listHeaders.mockResolvedValue([headers(1)]);
    jobMailbox.fetchMessage.mockImplementation(jobMail => Promise.resolve(withBody(jobMail)));
    jobMailMessages.findKnownKeys.mockResolvedValue(new Set());
    triage.classify.mockImplementation(jobMails => Promise.resolve(jobMails.map(() => JobMailKindEnum.JOB_ALERT)));
    sources.findByURL.mockResolvedValue(SOURCE);
    listing.classify.mockResolvedValue([BACKEND, QA]);
    preferences.findAll.mockResolvedValue([
      { name: 'developer', preferences: { role_families: [RoleFamilyEnum.BACKEND], places: [], excluded_companies: [] } }
    ]);
    vacancies.findKnown.mockResolvedValue([]);
    vacancies.applyScan.mockResolvedValue({
      created: [
        { vacancyId: 10, stage: VacancyStageEnum.LISTED },
        { vacancyId: 11, stage: VacancyStageEnum.SKIPPED }
      ],
      updated: [],
      closedIds: []
    });
    vacancies.findTextSearchDue.mockResolvedValue([]);
    moduleFixture = await Test.createTestingModule({
      providers: [
        JobMailReadOrchestrator,
        { provide: JobMailTriageService, useValue: triage },
        { provide: ListingExtractionService, useValue: listing },
        { provide: ProfilePreferencesService, useValue: preferences },
        { provide: PipelineEventsService, useValue: events },
        { provide: JobMailMessageRepository, useValue: jobMailMessages },
        { provide: SourceRepository, useValue: sources },
        { provide: VacancyRepository, useValue: vacancies },
        { provide: JobMailProviderRegistry, useValue: registry },
        {
          provide: ConfigService,
          useValue: createConfigMock({
            JOB_MAIL_PROVIDER: JobMailProviderEnum.IMAP,
            JOB_MAIL_LOOKBACK_HOURS: 24,
            JOB_MAIL_MAX_MESSAGES: 100,
            JOB_MAIL_TEXT_RECHECK_DAYS: 7,
            JOB_MAIL_TEXT_MAX_SEARCHES: 3,
            VACANCY_RECHECK_HOURS: 24,
            LISTING_MAX_LINKS: 500
          })
        }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(JobMailReadOrchestrator);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('isEnabled asks the provider of JOB_MAIL_PROVIDER', () => {
    expect(subjectUnderTest.isEnabled()).toBe(true);

    provider.isConfigured.mockReturnValue(false);

    expect(subjectUnderTest.isEnabled()).toBe(false);
  });

  describe('read', () => {
    it('reads a job alert like a listing: links, LLM, screen, vacancies, extraction — and closes nothing', async () => {
      const summary = await subjectUnderTest.read();

      expect(jobMailbox.listHeaders).toHaveBeenCalledWith(new Date('2026-11-23T12:00:00Z'), 100);
      expect(listing.classify).toHaveBeenCalledWith(
        'mailto:@jobs.example.com',
        [
          expect.objectContaining({ url: 'https://jobs.example.com/job/7', text: 'Backend Developer' }),
          expect.objectContaining({ url: 'https://jobs.example.com/job/8', text: 'QA Engineer' })
        ],
        'Northwind Careers',
        false
      );

      const [plan] = vacancies.applyScan.mock.calls[0] ?? [];

      expect(plan?.closeIds).toEqual([]);
      expect(
        plan?.inserts.map(insert => [insert.source_id, insert.vacancy_title, insert.vacancy_stage, insert.vacancy_skip_reason])
      ).toEqual([
        [25, 'Backend Developer', VacancyStageEnum.LISTED, null],
        [25, 'QA Engineer', VacancyStageEnum.SKIPPED, 'role qa is not searched']
      ]);
      expect(events.queueExtraction).toHaveBeenCalledWith([10]);
      expect(jobMailMessages.create).toHaveBeenCalledWith([
        {
          job_mail_message_key: '<mail-1@example.com>',
          job_mail_message_provider: JobMailProviderEnum.IMAP,
          job_mail_message_provider_id: '7:1',
          job_mail_message_sender_domain: 'jobs.example.com',
          job_mail_message_received_at: headers(1).receivedAt,
          job_mail_message_kind: JobMailKindEnum.JOB_ALERT,
          job_mail_message_status: JobMailMessageStatusEnum.PROCESSED,
          source_id: 25,
          job_mail_message_links: 2,
          job_mail_message_positions: 2,
          job_mail_message_created: 2
        }
      ]);
      expect(summary).toEqual({
        since: new Date('2026-11-23T12:00:00Z'),
        mails: 1,
        fresh: 1,
        alerts: 1,
        failed: 0,
        positions: 2,
        created: 2,
        queued: 1
      });
      expect(jobMailbox.close).toHaveBeenCalledTimes(1);
    });

    it('takes the width of the window from the argument', async () => {
      await subjectUnderTest.read(72);

      expect(jobMailbox.listHeaders).toHaveBeenCalledWith(new Date('2026-11-21T12:00:00Z'), 100);
    });

    it('never reads an e-mail twice: the known keys reach neither the LLM nor the mailbox', async () => {
      jobMailMessages.findKnownKeys.mockResolvedValue(new Set(['<mail-1@example.com>']));

      const summary = await subjectUnderTest.read();

      expect(jobMailMessages.findKnownKeys).toHaveBeenCalledWith(['<mail-1@example.com>']);
      expect(triage.classify).toHaveBeenCalledWith([]);
      expect(jobMailbox.fetchMessage).not.toHaveBeenCalled();
      expect(preferences.findAll).not.toHaveBeenCalled();
      expect(summary).toMatchObject({ mails: 1, fresh: 0, alerts: 0 });
    });

    it('records any other kind as ignored without fetching its body', async () => {
      jobMailbox.listHeaders.mockResolvedValue([headers(1, { senderAddress: 'hr@agency.example.org' }), headers(2)]);
      triage.classify.mockResolvedValue([JobMailKindEnum.RECRUITER, JobMailKindEnum.OTHER]);

      await subjectUnderTest.read();

      expect(jobMailbox.fetchMessage).not.toHaveBeenCalled();
      expect(sources.findByURL).not.toHaveBeenCalled();
      expect(jobMailMessages.create).toHaveBeenCalledWith([
        expect.objectContaining({
          job_mail_message_sender_domain: 'agency.example.org',
          job_mail_message_kind: JobMailKindEnum.RECRUITER,
          job_mail_message_status: JobMailMessageStatusEnum.IGNORED
        }),
        expect.objectContaining({ job_mail_message_kind: JobMailKindEnum.OTHER, job_mail_message_status: JobMailMessageStatusEnum.IGNORED })
      ]);
    });

    it('records the alert of a source the owner switched off as ignored, with its source, without fetching it', async () => {
      sources.findByURL.mockResolvedValue({ ...SOURCE, source_is_active: false });

      const summary = await subjectUnderTest.read();

      expect(jobMailbox.fetchMessage).not.toHaveBeenCalled();
      expect(jobMailMessages.create).toHaveBeenCalledWith([
        expect.objectContaining({
          source_id: 25,
          job_mail_message_kind: JobMailKindEnum.JOB_ALERT,
          job_mail_message_status: JobMailMessageStatusEnum.IGNORED
        })
      ]);
      expect(summary.alerts).toBe(0);
    });

    it('creates the source of a new sender domain once, named by the domain', async () => {
      const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      sources.findByURL.mockResolvedValue(undefined);
      sources.create.mockResolvedValue(SOURCE);

      await subjectUnderTest.read();

      expect(sources.create).toHaveBeenCalledWith({
        source_name: 'jobs.example.com',
        source_url: 'mailto:@jobs.example.com',
        source_fetch_mode: SourceFetchModeEnum.JOB_MAIL
      });
      expect(log).toHaveBeenCalledWith({ message: 'Job mail source created', sourceId: 25, domain: 'jobs.example.com' });
    });

    it('finds the source a parallel run created first', async () => {
      sources.findByURL.mockResolvedValueOnce(undefined).mockResolvedValueOnce(SOURCE);
      sources.create.mockResolvedValue(undefined);

      await expect(subjectUnderTest.read()).resolves.toMatchObject({ alerts: 1 });
    });

    it('refuses an alert whose source is neither found nor created', async () => {
      sources.findByURL.mockResolvedValue(undefined);
      sources.create.mockResolvedValue(undefined);

      await expect(subjectUnderTest.read()).rejects.toThrow('JOB_MAIL_SOURCE_NOT_CREATED: mailto:@jobs.example.com');
      expect(jobMailbox.close).toHaveBeenCalledTimes(1);
    });

    it('takes the source name as the company of an alert from a sender without a name', async () => {
      jobMailbox.listHeaders.mockResolvedValue([headers(1, { senderName: null })]);

      await subjectUnderTest.read();

      expect(listing.classify).toHaveBeenCalledWith('mailto:@jobs.example.com', expect.any(Array), 'jobs.example.com', false);
    });

    it('asks the LLM nothing for an alert without links', async () => {
      jobMailbox.fetchMessage.mockImplementation(jobMail => Promise.resolve(withBody(jobMail, null)));
      vacancies.applyScan.mockResolvedValue({ created: [], updated: [], closedIds: [] });

      await expect(subjectUnderTest.read()).resolves.toMatchObject({ alerts: 1, positions: 0, created: 0, queued: 0 });
      expect(listing.classify).not.toHaveBeenCalled();
    });

    it('records an alert that failed for good with its code and reads the next one', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      jobMailbox.listHeaders.mockResolvedValue([headers(1), headers(2)]);
      jobMailbox.fetchMessage.mockRejectedValueOnce(new Error('JOB_MAIL_MESSAGE_GONE: 7:1'));

      const summary = await subjectUnderTest.read();

      expect(jobMailMessages.create).toHaveBeenCalledWith([
        expect.objectContaining({
          job_mail_message_provider_id: '7:1',
          job_mail_message_status: JobMailMessageStatusEnum.FAILED,
          job_mail_message_error: 'JOB_MAIL_MESSAGE_GONE',
          source_id: 25
        })
      ]);
      expect(jobMailMessages.create).toHaveBeenCalledWith([
        expect.objectContaining({ job_mail_message_provider_id: '7:2', job_mail_message_status: JobMailMessageStatusEnum.PROCESSED })
      ]);
      expect(warn).toHaveBeenCalledWith({ message: 'Job alert failed', providerId: '7:1', code: 'JOB_MAIL_MESSAGE_GONE' });
      expect(summary).toMatchObject({ alerts: 1, failed: 1 });
    });

    it('passes a transient failure on, keeps the alert unrecorded and closes the mailbox', async () => {
      const transient = new Error('LLM_TIMEOUT: 60000 ms');

      listing.classify.mockRejectedValue(transient);

      await expect(subjectUnderTest.read()).rejects.toBe(transient);
      expect(jobMailMessages.create).not.toHaveBeenCalledWith([expect.objectContaining({ job_mail_message_provider_id: '7:1' })]);
      expect(jobMailbox.close).toHaveBeenCalledTimes(1);
    });

    it('queues again the vacancies whose description is due to be looked up', async () => {
      vacancies.findTextSearchDue.mockResolvedValue([40, 41]);

      const summary = await subjectUnderTest.read();

      expect(vacancies.findTextSearchDue).toHaveBeenCalledWith(new Date('2026-11-17T12:00:00Z'), 3);
      expect(events.queueExtraction).toHaveBeenCalledWith([40, 41]);
      expect(summary.queued).toBe(3);
    });

    it('passes on a mailbox that does not open', async () => {
      provider.open.mockRejectedValue(new Error('JOB_MAIL_AUTH_FAILED: refused'));

      await expect(subjectUnderTest.read()).rejects.toThrow('JOB_MAIL_AUTH_FAILED');
      expect(triage.classify).not.toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    it('classifies every e-mail of the window, read before or not, shows the links of the alerts and stores nothing', async () => {
      jobMailbox.listHeaders.mockResolvedValue([headers(1), headers(2)]);
      triage.classify.mockResolvedValue([JobMailKindEnum.JOB_ALERT, JobMailKindEnum.OTHER]);

      const preview = await subjectUnderTest.preview(48);

      expect(jobMailbox.listHeaders).toHaveBeenCalledWith(new Date('2026-11-22T12:00:00Z'), 100);
      expect(jobMailMessages.findKnownKeys).not.toHaveBeenCalled();
      expect(jobMailbox.fetchMessage).toHaveBeenCalledTimes(1);
      expect(preview.messages.map(message => [message.headers.providerId, message.kind, message.links.map(link => link.url)])).toEqual([
        ['7:1', JobMailKindEnum.JOB_ALERT, ['https://jobs.example.com/job/7', 'https://jobs.example.com/job/8']],
        ['7:2', JobMailKindEnum.OTHER, []]
      ]);
      expect(jobMailMessages.create).not.toHaveBeenCalled();
      expect(vacancies.applyScan).not.toHaveBeenCalled();
      expect(listing.classify).not.toHaveBeenCalled();
      expect(jobMailbox.close).toHaveBeenCalledTimes(1);
    });

    it('reads an e-mail the LLM left out as a job alert', async () => {
      triage.classify.mockResolvedValue([]);

      const preview = await subjectUnderTest.preview();

      expect(preview.messages[0]?.kind).toBe(JobMailKindEnum.JOB_ALERT);
    });
  });
});
