import { randomInt } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { JobNameEnum, SourceStatusEnum, VacancyStageEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import type { IFetchedPage } from '../../crawler/interfaces/fetched-page.interface.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { vacancyDedupKey } from '../../vacancies/helpers/vacancy-key.helper.js';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { SourceScanOutcomeEnum } from '../enums/source-scan-outcome.enum.js';
import { listingSkipReason } from '../helpers/listing-filter.helper.js';
import { planListingScan } from '../helpers/listing-scan.helper.js';
import type { IScanSourceJob } from '../interfaces/scan-source-job.interface.js';
import type { SourceRowType } from '../interfaces/source-row.interface.js';
import type { ISourceScanSummary } from '../interfaces/source-scan-summary.interface.js';
import { SourceRepository } from '../repositories/source.repository.js';
import { ListingExtractionService } from './listing-extraction.service.js';
import { ProfilePreferencesService } from './profile-preferences.service.js';

/**
 * Crawler refusals that stop a source until the owner resets its status
 *
 * @type {ReadonlyMap<CrawlErrorCodeEnum, SourceStatusEnum>}
 */
const STOPPING_ERRORS: ReadonlyMap<CrawlErrorCodeEnum, SourceStatusEnum> = new Map([
  [CrawlErrorCodeEnum.ROBOTS_DISALLOWED, SourceStatusEnum.BLOCKED_BY_ROBOTS],
  [CrawlErrorCodeEnum.SOURCE_BLOCKED, SourceStatusEnum.BLOCKED]
]);

/**
 * Milliseconds in a minute
 *
 * @type {number}
 */
const MINUTE_MS = 60_000;

/**
 * Milliseconds in an hour
 *
 * @type {number}
 */
const HOUR_MS = 3_600_000;

/**
 * Scans the career pages: fetch the listing politely, let the LLM pick and classify the positions, drop the ones no
 * profile searches for by code, write the vacancies, queue the new ones for extraction, tell the owner about the
 * vacancies they heard of that are gone
 */
@Injectable()
export class SourceScanOrchestrator {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(SourceScanOrchestrator.name);

  /**
   * @param {CrawlerService} crawlerService
   * @param {ListingExtractionService} listingExtractionService
   * @param {ProfilePreferencesService} profilePreferencesService
   * @param {PipelineEventsService} pipelineEventsService
   * @param {SourceRepository} sourceRepository
   * @param {VacancyRepository} vacancyRepository
   * @param {Queue} searchQueue
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly listingExtractionService: ListingExtractionService,
    private readonly profilePreferencesService: ProfilePreferencesService,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly sourceRepository: SourceRepository,
    private readonly vacancyRepository: VacancyRepository,
    @InjectQueue('search') private readonly searchQueue: Queue,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Queue a scan of every scannable source, each shifted by a random delay up to `SEARCH_JITTER_MINUTES`; a source
   * whose scan is still waiting is not queued twice
   *
   * @returns {Promise<number>} The number of sources queued
   */
  async queueScans(): Promise<number> {
    const sources = await this.sourceRepository.findScannable();
    const jitterMs = this.configService.get('SEARCH_JITTER_MINUTES', { infer: true }) * MINUTE_MS;

    await Promise.all(
      sources.map(async source =>
        this.searchQueue.add(JobNameEnum.SCAN_SOURCE, { sourceId: source.source_id } satisfies IScanSourceJob, {
          delay: randomInt(0, jitterMs + 1),
          deduplication: { id: `${JobNameEnum.SCAN_SOURCE}:${source.source_id}` }
        })
      )
    );

    this.logger.log({ message: 'Source scans queued', sources: sources.length });

    return sources.length;
  }

  /**
   * Scan one source
   *
   * @param {IScanSourceJob} request
   *
   * @throws {Error} `SOURCE_NOT_FOUND` if there is no such source
   * @throws {CrawlError} If the page was not fetched for a reason that does not stop the source
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID`, `PROFILE_PREFERENCES_INVALID` or a transient LLM / database error
   *
   * @returns {Promise<ISourceScanSummary>}
   */
  async scan(request: IScanSourceJob): Promise<ISourceScanSummary> {
    const source = await this.sourceRepository.findOne(request.sourceId);

    if (!source) {
      throw new Error(`SOURCE_NOT_FOUND: ${request.sourceId}`);
    }

    if (!request.force && (!source.source_is_active || source.source_status !== SourceStatusEnum.OK)) {
      this.logger.debug({ message: 'Source not scanned', sourceId: source.source_id, status: source.source_status });

      return this.summary(source.source_id, SourceScanOutcomeEnum.SKIPPED);
    }

    const page = await this.fetchListing(source);

    if (!page) {
      return this.summary(source.source_id, SourceScanOutcomeEnum.BLOCKED);
    }

    try {
      return await this.processListing(source, page);
    } catch (error) {
      await this.sourceRepository.markFailed(source.source_id, (error as Error).message);

      throw error;
    }
  }

  /**
   * Fetch the listing page; a refusal that stops the source marks it, tells the owner and yields nothing
   *
   * @param {SourceRowType} source
   *
   * @throws {CrawlError} If the page was not fetched for another reason — the source keeps its status
   *
   * @returns {Promise<IFetchedPage | undefined>}
   */
  private async fetchListing(source: SourceRowType): Promise<IFetchedPage | undefined> {
    try {
      return await this.crawlerService.fetchPage(source.source_url, source.source_fetch_mode);
    } catch (error) {
      if (!(error instanceof CrawlError)) {
        throw error;
      }

      const status = STOPPING_ERRORS.get(error.code);

      await this.sourceRepository.markFailed(source.source_id, error.message, status);

      if (!status) {
        throw error;
      }

      this.logger.warn({ message: 'Source stopped', sourceId: source.source_id, status, reason: error.message });
      await this.pipelineEventsService.sourceBlocked(source.source_id);

      return undefined;
    }
  }

  /**
   * Classify, screen and write the positions of a fetched page, queue what follows
   *
   * @param {SourceRowType} source
   * @param {IFetchedPage} page
   *
   * @returns {Promise<ISourceScanSummary>}
   */
  private async processListing(source: SourceRowType, page: IFetchedPage): Promise<ISourceScanSummary> {
    const listing = await this.listingExtractionService.extract(page, source.source_name);
    const profiles = await this.profilePreferencesService.findAll();
    const positions = listing.positions.map(position => ({ ...position, skipReason: listingSkipReason(position, profiles) }));
    const [known, open] = await Promise.all([
      this.vacancyRepository.findKnown(
        positions.map(position => position.url),
        positions.map(position => vacancyDedupKey(position.company, position.title))
      ),
      this.vacancyRepository.findOpenBySource(source.source_id)
    ]);
    const now = new Date();
    const recheckBefore = new Date(now.getTime() - this.configService.get('VACANCY_RECHECK_HOURS', { infer: true }) * HOUR_MS);
    const plan = planListingScan({ sourceId: source.source_id, positions, known, open, now, recheckBefore });
    const result = await this.vacancyRepository.applyScan(plan);
    const written = [...result.created, ...result.updated];
    const extractIds = written.filter(vacancy => vacancy.stage === VacancyStageEnum.LISTED).map(vacancy => vacancy.vacancyId);

    await this.pipelineEventsService.queueExtraction([...extractIds, ...plan.recheckIds]);
    await this.pipelineEventsService.vacanciesClosed(result.closedIds);
    await this.sourceRepository.markScanned(source.source_id);

    if (positions.length === 0 && open.length > 0) {
      this.logger.warn({
        message: 'Listing has no positions, nothing closed',
        sourceId: source.source_id,
        links: listing.links,
        open: open.length
      });
    }

    const summary = {
      ...this.summary(source.source_id, SourceScanOutcomeEnum.SCANNED),
      links: listing.links,
      positions: positions.length,
      created: result.created.length,
      skipped: written.filter(vacancy => vacancy.stage === VacancyStageEnum.SKIPPED).length,
      closed: result.closedIds.length,
      queued: extractIds.length + plan.recheckIds.length
    };

    this.logger.log({ message: 'Source scanned', ...summary });

    return summary;
  }

  /**
   * A summary with nothing counted
   *
   * @param {number} sourceId
   * @param {SourceScanOutcomeEnum} outcome
   *
   * @returns {ISourceScanSummary}
   */
  private summary(sourceId: number, outcome: SourceScanOutcomeEnum): ISourceScanSummary {
    return { sourceId, outcome, links: 0, positions: 0, created: 0, skipped: 0, closed: 0, queued: 0 };
  }
}
