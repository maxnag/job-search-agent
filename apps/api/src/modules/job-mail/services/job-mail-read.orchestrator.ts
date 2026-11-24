import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';

import { JobMailKindEnum, JobMailMessageStatusEnum, SourceFetchModeEnum, VacancyStageEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { toJobError } from '../../queues/helpers/job-error.helper.js';
import { listingSkipReason } from '../../search/helpers/listing-filter.helper.js';
import { extractLinkCandidates } from '../../search/helpers/listing-page.helper.js';
import { planListingScan } from '../../search/helpers/listing-scan.helper.js';
import type { ILinkCandidate } from '../../search/interfaces/link-candidate.interface.js';
import type { IProfilePreferencesEntry } from '../../search/interfaces/profile-preferences-entry.interface.js';
import type { SourceRowType } from '../../search/interfaces/source-row.interface.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import { ListingExtractionService } from '../../search/services/listing-extraction.service.js';
import { ProfilePreferencesService } from '../../search/services/profile-preferences.service.js';
import { VACANCY_FIELD_LIMITS, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import { vacancyDedupKey } from '../../vacancies/helpers/vacancy-key.helper.js';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { senderDomain } from '../helpers/job-mail-address.helper.js';
import { jobMailLinks } from '../helpers/job-mail-link.helper.js';
import type { JobMailMessageInsertType } from '../interfaces/job-mail-message-row.interface.js';
import type { IJobMailHeaders, IJobMailMessage } from '../interfaces/job-mail-message.interface.js';
import type { IJobMailPreview, IJobMailPreviewMessage } from '../interfaces/job-mail-preview.interface.js';
import type { IJobMailProvider, IJobMailbox } from '../interfaces/job-mail-provider.interface.js';
import type { IJobMailReadSummary } from '../interfaces/job-mail-read-summary.interface.js';
import { JobMailMessageRepository } from '../repositories/job-mail-message.repository.js';
import { JobMailProviderRegistry } from './job-mail-provider.registry.js';
import { JobMailTriageService } from './job-mail-triage.service.js';

/**
 * Milliseconds in an hour
 *
 * @type {number}
 */
const HOUR_MS = 60 * 60 * 1000;

/**
 * Milliseconds in a day
 *
 * @type {number}
 */
const DAY_MS = 24 * HOUR_MS;

/**
 * Base the links of an e-mail are resolved against — an e-mail has no address of its own, so only absolute links count
 *
 * @type {string}
 */
const JOB_MAIL_BASE_URL = 'about:blank';

/**
 * Scheme of the source of a sender domain: `mailto:@<domain>`
 *
 * @type {string}
 */
const SOURCE_URL_PREFIX = 'mailto:@';

/**
 * Domain recorded for a sender without an address
 *
 * @type {string}
 */
const UNKNOWN_DOMAIN = 'unknown';

/**
 * A job alert with the source of its sender domain
 */
interface IJobAlert {
  /**
   * Headers of the e-mail
   *
   * @var {IJobMailHeaders}
   */
  readonly headers: IJobMailHeaders;

  /**
   * Source of the sender domain
   *
   * @var {SourceRowType}
   */
  readonly source: SourceRowType;
}

/**
 * What one job alert wrote
 */
interface IAlertResult {
  /**
   * Row of the e-mail
   *
   * @var {JobMailMessageInsertType}
   */
  readonly row: JobMailMessageInsertType;

  /**
   * Vacancies queued for extraction
   *
   * @var {number}
   */
  readonly queued: number;
}

/**
 * Reads the mailbox: the e-mails of the last `JOB_MAIL_LOOKBACK_HOURS` not read before, their kind told by the LLM from
 * the headers; only a job alert has its body fetched. Its links are read like a listing — the LLM picks the vacancies by
 * number, code screens them by the profiles —, and the new vacancies go to the extraction. A job alert closes nothing:
 * it is never the whole list
 */
@Injectable()
export class JobMailReadOrchestrator {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(JobMailReadOrchestrator.name);

  /**
   * @param {JobMailTriageService} jobMailTriageService
   * @param {ListingExtractionService} listingExtractionService
   * @param {ProfilePreferencesService} profilePreferencesService
   * @param {PipelineEventsService} pipelineEventsService
   * @param {JobMailMessageRepository} jobMailMessageRepository
   * @param {SourceRepository} sourceRepository
   * @param {VacancyRepository} vacancyRepository
   * @param {JobMailProviderRegistry} jobMailProviderRegistry
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly jobMailTriageService: JobMailTriageService,
    private readonly listingExtractionService: ListingExtractionService,
    private readonly profilePreferencesService: ProfilePreferencesService,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly jobMailMessageRepository: JobMailMessageRepository,
    private readonly sourceRepository: SourceRepository,
    private readonly vacancyRepository: VacancyRepository,
    private readonly jobMailProviderRegistry: JobMailProviderRegistry,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * True when the provider of `JOB_MAIL_PROVIDER` has its keys
   *
   * @returns {boolean}
   */
  isEnabled(): boolean {
    return this.provider().isConfigured();
  }

  /**
   * Read the e-mails of the window not read before; also queue again the vacancies whose description is due to be
   * looked up again
   *
   * @param {number} [hours] Width of the window, `JOB_MAIL_LOOKBACK_HOURS` by default
   *
   * @throws {Error} `JOB_MAIL_NOT_CONFIGURED`, `JOB_MAIL_AUTH_FAILED` or `JOB_MAIL_CONNECTION_FAILED` from the provider
   * @throws {Error} A transient LLM, mailbox or database error — the e-mails recorded so far are not read again
   *
   * @returns {Promise<IJobMailReadSummary>}
   */
  async read(hours?: number): Promise<IJobMailReadSummary> {
    const since = this.windowStart(hours);
    const jobMailbox = await this.provider().open();

    try {
      const headers = await jobMailbox.listHeaders(since, this.configService.get('JOB_MAIL_MAX_MESSAGES', { infer: true }));
      const known = await this.jobMailMessageRepository.findKnownKeys(headers.map(jobMail => jobMail.messageKey));
      const fresh = headers.filter(jobMail => !known.has(jobMail.messageKey));
      const alerts = await this.triage(fresh);
      const profiles = alerts.length > 0 ? await this.profilePreferencesService.findAll() : [];
      const results: IAlertResult[] = [];

      for (const alert of alerts) {
        const result = await this.readAlert(jobMailbox, alert, profiles);

        await this.jobMailMessageRepository.create([result.row]);
        results.push(result);
      }

      const rechecked = await this.queueTextSearches();
      const summary: IJobMailReadSummary = {
        since,
        mails: headers.length,
        fresh: fresh.length,
        alerts: results.filter(result => result.row.job_mail_message_status === JobMailMessageStatusEnum.PROCESSED).length,
        failed: results.filter(result => result.row.job_mail_message_status === JobMailMessageStatusEnum.FAILED).length,
        positions: results.reduce((sum, result) => sum + (result.row.job_mail_message_positions ?? 0), 0),
        created: results.reduce((sum, result) => sum + (result.row.job_mail_message_created ?? 0), 0),
        queued: results.reduce((sum, result) => sum + result.queued, 0) + rechecked
      };

      this.logger.log({ message: 'Job mail read', ...summary });

      return summary;
    } finally {
      await jobMailbox.close();
    }
  }

  /**
   * A dry run: the e-mails of the window with their kind, and the links of every job alert as the LLM would see them;
   * nothing is stored, e-mails read before are listed too
   *
   * @param {number} [hours] Width of the window, `JOB_MAIL_LOOKBACK_HOURS` by default
   *
   * @throws {Error} `JOB_MAIL_NOT_CONFIGURED`, `JOB_MAIL_AUTH_FAILED` or `JOB_MAIL_CONNECTION_FAILED` from the provider
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` or a transient LLM error
   *
   * @returns {Promise<IJobMailPreview>}
   */
  async preview(hours?: number): Promise<IJobMailPreview> {
    const since = this.windowStart(hours);
    const jobMailbox = await this.provider().open();

    try {
      const headers = await jobMailbox.listHeaders(since, this.configService.get('JOB_MAIL_MAX_MESSAGES', { infer: true }));
      const kinds = await this.jobMailTriageService.classify(headers);
      const messages: IJobMailPreviewMessage[] = [];

      for (const [index, jobMail] of headers.entries()) {
        const kind = kinds[index] ?? JobMailKindEnum.JOB_ALERT;
        const links = kind === JobMailKindEnum.JOB_ALERT ? jobMailLinks(this.links(await jobMailbox.fetchMessage(jobMail))) : [];

        messages.push({ headers: jobMail, kind, links });
      }

      this.logger.log({
        message: 'Job mailbox previewed',
        jobMails: messages.length,
        alerts: messages.filter(message => message.kind === JobMailKindEnum.JOB_ALERT).length
      });

      return { since, messages };
    } finally {
      await jobMailbox.close();
    }
  }

  /**
   * Classify the new e-mails and record every one that is not a job alert to read — any other kind, or the alert of a
   * source the owner switched off — so none is classified twice
   *
   * @param {readonly IJobMailHeaders[]} fresh
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` or a transient LLM error
   *
   * @returns {Promise<IJobAlert[]>} The job alerts to read, with the source of each
   */
  private async triage(fresh: readonly IJobMailHeaders[]): Promise<IJobAlert[]> {
    const kinds = await this.jobMailTriageService.classify(fresh);
    const ignored: JobMailMessageInsertType[] = [];
    const alerts: IJobAlert[] = [];

    for (const [index, headers] of fresh.entries()) {
      const kind = kinds[index] ?? JobMailKindEnum.JOB_ALERT;

      if (kind !== JobMailKindEnum.JOB_ALERT) {
        ignored.push(this.row(headers, kind, JobMailMessageStatusEnum.IGNORED));

        continue;
      }

      const source = await this.alertSource(headers);

      if (source.source_is_active) {
        alerts.push({ headers, source });
      } else {
        ignored.push({ ...this.row(headers, kind, JobMailMessageStatusEnum.IGNORED), source_id: source.source_id });
      }
    }

    await this.jobMailMessageRepository.create(ignored);

    return alerts;
  }

  /**
   * Read one job alert; a permanent failure is recorded as `failed`, a transient one is passed on and the alert is read
   * again on the next attempt
   *
   * @param {IJobMailbox} jobMailbox
   * @param {IJobAlert} alert
   * @param {readonly IProfilePreferencesEntry[]} profiles
   *
   * @throws {Error} A transient LLM, mailbox or database error
   *
   * @returns {Promise<IAlertResult>}
   */
  private async readAlert(jobMailbox: IJobMailbox, alert: IJobAlert, profiles: readonly IProfilePreferencesEntry[]): Promise<IAlertResult> {
    try {
      return await this.processAlert(jobMailbox, alert, profiles);
    } catch (error) {
      if (!(toJobError(error) instanceof UnrecoverableError)) {
        throw error;
      }

      const code = (error as Error).message.split(':')[0] ?? 'UNKNOWN';

      this.logger.warn({ message: 'Job alert failed', providerId: alert.headers.providerId, code });

      return {
        row: {
          ...this.row(alert.headers, JobMailKindEnum.JOB_ALERT, JobMailMessageStatusEnum.FAILED),
          source_id: alert.source.source_id,
          job_mail_message_error: code
        },
        queued: 0
      };
    }
  }

  /**
   * Fetch a job alert, pick and screen its vacancies, write them and queue the extraction of the new ones
   *
   * @param {IJobMailbox} jobMailbox
   * @param {IJobAlert} alert
   * @param {readonly IProfilePreferencesEntry[]} profiles
   *
   * @returns {Promise<IAlertResult>}
   */
  private async processAlert(
    jobMailbox: IJobMailbox,
    alert: IJobAlert,
    profiles: readonly IProfilePreferencesEntry[]
  ): Promise<IAlertResult> {
    const message = await jobMailbox.fetchMessage(alert.headers);
    const candidates = jobMailLinks(this.links(message));
    const company = clipText(alert.headers.senderName ?? alert.source.source_name, VACANCY_FIELD_LIMITS.company);
    const listed =
      candidates.length > 0 ? await this.listingExtractionService.classify(alert.source.source_url, candidates, company, false) : [];
    const positions = listed.map(position => ({ ...position, skipReason: listingSkipReason(position, profiles) }));
    const known = await this.vacancyRepository.findKnown(
      positions.map(position => position.url),
      positions.map(position => vacancyDedupKey(position.company, position.title))
    );
    const now = new Date();
    const recheckBefore = new Date(now.getTime() - this.configService.get('VACANCY_RECHECK_HOURS', { infer: true }) * HOUR_MS);
    const plan = planListingScan({ sourceId: alert.source.source_id, positions, gaps: [], known, open: [], now, recheckBefore });
    const result = await this.vacancyRepository.applyScan(plan);
    const extractIds = [...result.created, ...result.updated]
      .filter(vacancy => vacancy.stage === VacancyStageEnum.LISTED)
      .map(vacancy => vacancy.vacancyId);
    const queued = [...new Set([...extractIds, ...plan.recheckIds])];

    await this.pipelineEventsService.queueExtraction(queued);
    this.logger.debug({
      message: 'Job alert read',
      providerId: alert.headers.providerId,
      sourceId: alert.source.source_id,
      links: candidates.length,
      positions: positions.length,
      created: result.created.length
    });

    return {
      row: {
        ...this.row(alert.headers, JobMailKindEnum.JOB_ALERT, JobMailMessageStatusEnum.PROCESSED),
        source_id: alert.source.source_id,
        job_mail_message_links: candidates.length,
        job_mail_message_positions: positions.length,
        job_mail_message_created: result.created.length
      },
      queued: queued.length
    };
  }

  /**
   * The source of the sender domain of a job alert — found, or created on its first alert
   *
   * @param {IJobMailHeaders} headers
   *
   * @throws {Error} `JOB_MAIL_SOURCE_NOT_CREATED` if the source is neither found nor created
   *
   * @returns {Promise<SourceRowType>}
   */
  private async alertSource(headers: IJobMailHeaders): Promise<SourceRowType> {
    const domain = senderDomain(headers.senderAddress) || UNKNOWN_DOMAIN;
    const url = `${SOURCE_URL_PREFIX}${domain}`;
    const known = await this.sourceRepository.findByURL(url);

    if (known) {
      return known;
    }

    const created =
      (await this.sourceRepository.create({ source_name: domain, source_url: url, source_fetch_mode: SourceFetchModeEnum.JOB_MAIL })) ??
      (await this.sourceRepository.findByURL(url));

    if (!created) {
      throw new Error(`JOB_MAIL_SOURCE_NOT_CREATED: ${url}`);
    }

    this.logger.log({ message: 'Job mail source created', sourceId: created.source_id, domain });

    return created;
  }

  /**
   * Queue again the vacancies whose description was not found and is due to be looked up again
   *
   * @returns {Promise<number>}
   */
  private async queueTextSearches(): Promise<number> {
    const days = this.configService.get('JOB_MAIL_TEXT_RECHECK_DAYS', { infer: true });
    const due = await this.vacancyRepository.findTextSearchDue(
      new Date(Date.now() - days * DAY_MS),
      this.configService.get('JOB_MAIL_TEXT_MAX_SEARCHES', { infer: true })
    );

    await this.pipelineEventsService.queueExtraction(due);

    return due.length;
  }

  /**
   * The row of an e-mail read
   *
   * @param {IJobMailHeaders} headers
   * @param {JobMailKindEnum} kind
   * @param {JobMailMessageStatusEnum} status
   *
   * @returns {JobMailMessageInsertType}
   */
  private row(headers: IJobMailHeaders, kind: JobMailKindEnum, status: JobMailMessageStatusEnum): JobMailMessageInsertType {
    return {
      job_mail_message_key: headers.messageKey,
      job_mail_message_provider: this.configService.get('JOB_MAIL_PROVIDER', { infer: true }),
      job_mail_message_provider_id: headers.providerId,
      job_mail_message_sender_domain: senderDomain(headers.senderAddress) || UNKNOWN_DOMAIN,
      job_mail_message_received_at: headers.receivedAt,
      job_mail_message_kind: kind,
      job_mail_message_status: status
    };
  }

  /**
   * Links of the HTML body of an e-mail; a job alert without HTML has none to pick
   *
   * @param {IJobMailMessage} message
   *
   * @returns {ILinkCandidate[]}
   */
  private links(message: IJobMailMessage): ILinkCandidate[] {
    if (!message.html) {
      return [];
    }

    return extractLinkCandidates(message.html, JOB_MAIL_BASE_URL, this.configService.get('LISTING_MAX_LINKS', { infer: true })).candidates;
  }

  /**
   * Start of the window
   *
   * @param {number} [hours] Width of the window, `JOB_MAIL_LOOKBACK_HOURS` by default
   *
   * @returns {Date}
   */
  private windowStart(hours?: number): Date {
    return new Date(Date.now() - (hours ?? this.configService.get('JOB_MAIL_LOOKBACK_HOURS', { infer: true })) * HOUR_MS);
  }

  /**
   * Adapter of `JOB_MAIL_PROVIDER`
   *
   * @returns {IJobMailProvider}
   */
  private provider(): IJobMailProvider {
    return this.jobMailProviderRegistry.findOne(this.configService.get('JOB_MAIL_PROVIDER', { infer: true }));
  }
}
