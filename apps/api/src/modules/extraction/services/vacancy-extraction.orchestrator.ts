import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SourceFetchModeEnum, SourceStatusEnum, VacancyStageEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import type { IFetchedPage } from '../../crawler/interfaces/fetched-page.interface.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { VacancyMatchingService } from '../../matching/services/vacancy-matching.service.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { VacancyExtractionOutcomeEnum } from '../enums/vacancy-extraction-outcome.enum.js';
import { normalizeVacancyExtraction } from '../helpers/vacancy-normalization.helper.js';
import { textHash, vacancyPageText } from '../helpers/vacancy-text.helper.js';
import type { IVacancyExtractionSummary } from '../interfaces/vacancy-extraction-summary.interface.js';
import { VacancyExtractionService } from './vacancy-extraction.service.js';

/**
 * Stages a vacancy is extracted at — a vacancy closed or dropped meanwhile is left alone
 *
 * @type {ReadonlySet<VacancyStageEnum>}
 */
const EXTRACTABLE_STAGES: ReadonlySet<VacancyStageEnum> = new Set([VacancyStageEnum.LISTED, VacancyStageEnum.EXTRACTED]);

/**
 * Fetch mode of a vacancy whose source row is gone
 *
 * @type {SourceFetchModeEnum}
 */
const SOURCE_FALLBACK_MODE = SourceFetchModeEnum.HTML;

/**
 * Skip reason of a vacancy page the site's robots.txt forbids
 *
 * @type {string}
 */
const ROBOTS_SKIP_REASON = 'robots.txt disallows the vacancy page';

/**
 * Skip reason of a vacancy link to the owner's machine, the LAN or the cloud metadata endpoint
 *
 * @type {string}
 */
const PRIVATE_ADDRESS_SKIP_REASON = 'the vacancy link leads to a private network address';

/**
 * Crawl refusals that drop a vacancy for good, with the reason the report shows
 *
 * @type {ReadonlyMap<CrawlErrorCodeEnum, string>}
 */
const SKIPPING_ERRORS: ReadonlyMap<CrawlErrorCodeEnum, string> = new Map([
  [CrawlErrorCodeEnum.ROBOTS_DISALLOWED, ROBOTS_SKIP_REASON],
  [CrawlErrorCodeEnum.PRIVATE_ADDRESS, PRIVATE_ADDRESS_SKIP_REASON]
]);

/**
 * Extracts a vacancy from its page: fetched politely in the mode of its source, reduced to text, hashed — the same
 * text costs no LLM call — extracted, normalized onto the skill dictionary, stored and matched against every
 * profile; new `fit` and `almost` verdicts are handed to the notifications. A page that is gone or says
 * the position is closed closes the vacancy
 */
@Injectable()
export class VacancyExtractionOrchestrator {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(VacancyExtractionOrchestrator.name);

  /**
   * @param {CrawlerService} crawlerService
   * @param {VacancyExtractionService} vacancyExtractionService
   * @param {VacancyMatchingService} vacancyMatchingService
   * @param {PipelineEventsService} pipelineEventsService
   * @param {VacancyRepository} vacancyRepository
   * @param {SourceRepository} sourceRepository
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly vacancyExtractionService: VacancyExtractionService,
    private readonly vacancyMatchingService: VacancyMatchingService,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly vacancyRepository: VacancyRepository,
    private readonly sourceRepository: SourceRepository,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Extract one vacancy
   *
   * @param {number} vacancyId
   *
   * @throws {Error} `VACANCY_NOT_FOUND` if there is no such vacancy
   * @throws {CrawlError} If the page was not fetched for a reason that neither closes nor skips the vacancy
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` or a transient LLM / database error
   *
   * @returns {Promise<IVacancyExtractionSummary>}
   */
  async extract(vacancyId: number): Promise<IVacancyExtractionSummary> {
    const vacancy = await this.vacancyRepository.findOne(vacancyId);

    if (!vacancy) {
      throw new Error(`VACANCY_NOT_FOUND: ${vacancyId}`);
    }

    if (!EXTRACTABLE_STAGES.has(vacancy.vacancy_stage)) {
      this.logger.debug({ message: 'Vacancy not extracted', vacancyId, stage: vacancy.vacancy_stage });

      return { vacancyId, outcome: VacancyExtractionOutcomeEnum.SKIPPED };
    }

    const page = await this.fetchVacancy(vacancy);

    if (page.outcome) {
      return { vacancyId, outcome: page.outcome };
    }

    return this.processPage(vacancy, page.page);
  }

  /**
   * Fetch the vacancy page in the mode of its source; a page that is gone closes the vacancy, a page robots.txt
   * forbids skips it, a refusal of the site stops the source
   *
   * @param {VacancyRowType} vacancy
   *
   * @throws {CrawlError} For a transient failure, or after the source is stopped
   *
   * @returns {Promise<{ page: IFetchedPage; outcome?: undefined } | { outcome: VacancyExtractionOutcomeEnum }>}
   */
  private async fetchVacancy(
    vacancy: VacancyRowType
  ): Promise<{ page: IFetchedPage; outcome?: undefined } | { outcome: VacancyExtractionOutcomeEnum }> {
    const source = await this.sourceRepository.findOne(vacancy.source_id);

    try {
      return { page: await this.crawlerService.fetchPage(vacancy.vacancy_url, source?.source_fetch_mode ?? SOURCE_FALLBACK_MODE) };
    } catch (error) {
      if (!(error instanceof CrawlError)) {
        throw error;
      }

      if (error.code === CrawlErrorCodeEnum.FETCH_HTTP_ERROR) {
        await this.close(vacancy.vacancy_id, error.message);

        return { outcome: VacancyExtractionOutcomeEnum.CLOSED };
      }

      const skipReason = SKIPPING_ERRORS.get(error.code);

      if (skipReason) {
        await this.vacancyRepository.update(vacancy.vacancy_id, {
          vacancy_stage: VacancyStageEnum.SKIPPED,
          vacancy_skip_reason: skipReason
        });

        return { outcome: VacancyExtractionOutcomeEnum.SKIPPED };
      }

      if (error.code === CrawlErrorCodeEnum.SOURCE_BLOCKED) {
        await this.sourceRepository.markFailed(vacancy.source_id, error.message, SourceStatusEnum.BLOCKED);
        await this.pipelineEventsService.sourceBlocked(vacancy.source_id);
      }

      throw error;
    }
  }

  /**
   * Extract and store the text of a fetched page, unless it has not changed
   *
   * @param {VacancyRowType} vacancy
   * @param {IFetchedPage} page
   *
   * @returns {Promise<IVacancyExtractionSummary>}
   */
  private async processPage(vacancy: VacancyRowType, page: IFetchedPage): Promise<IVacancyExtractionSummary> {
    const vacancyId = vacancy.vacancy_id;
    const text = vacancyPageText(page.html, this.configService.get('VACANCY_TEXT_MAX_CHARS', { infer: true }));
    const hash = textHash(text);
    const wasExtracted = vacancy.vacancy_data !== null;

    if (wasExtracted && hash === vacancy.vacancy_text_hash) {
      await this.vacancyRepository.update(vacancyId, { vacancy_checked_at: new Date() });
      this.logger.debug({ message: 'Vacancy unchanged', vacancyId });

      return { vacancyId, outcome: VacancyExtractionOutcomeEnum.UNCHANGED };
    }

    const { data, model } = await this.vacancyExtractionService.extract(text);

    if (!data.is_open) {
      await this.close(vacancyId, 'the page says the position is closed');

      return { vacancyId, outcome: VacancyExtractionOutcomeEnum.CLOSED };
    }

    const extracted = normalizeVacancyExtraction(data, model);
    const values = {
      vacancy_stage: VacancyStageEnum.EXTRACTED,
      vacancy_skip_reason: null,
      vacancy_text_hash: hash,
      vacancy_data: { ...extracted },
      vacancy_level: extracted.level,
      vacancy_country: extracted.country,
      vacancy_city: extracted.city,
      vacancy_work_mode: extracted.workMode,
      vacancy_checked_at: new Date()
    };

    await this.vacancyRepository.update(vacancyId, values);

    if (wasExtracted) {
      await this.pipelineEventsService.vacancyChanged(vacancyId);
    }

    const matched = await this.vacancyMatchingService.matchVacancy({ ...vacancy, ...values });

    await this.pipelineEventsService.vacanciesMatched(matched.notifiableMatchIds);

    const outcome = wasExtracted ? VacancyExtractionOutcomeEnum.CHANGED : VacancyExtractionOutcomeEnum.EXTRACTED;

    this.logger.log({
      message: 'Vacancy extracted',
      vacancyId,
      outcome,
      model,
      required: extracted.requiredLanguages.length,
      hebrew: extracted.hebrew,
      ...matched.verdicts,
      characters: text.length
    });

    return { vacancyId, outcome };
  }

  /**
   * Close a vacancy that is gone and tell the owner if they heard of it
   *
   * @param {number} vacancyId
   * @param {string} reason
   *
   * @returns {Promise<void>}
   */
  private async close(vacancyId: number, reason: string): Promise<void> {
    await this.vacancyRepository.close(vacancyId);
    await this.pipelineEventsService.vacanciesClosed([vacancyId]);
    this.logger.log({ message: 'Vacancy closed', vacancyId, reason });
  }
}
