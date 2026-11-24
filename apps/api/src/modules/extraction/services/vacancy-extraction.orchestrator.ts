import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SourceFetchModeEnum, SourceStatusEnum, VacancyStageEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { parseATSBoard } from '../../ats/helpers/a-t-s-board.helper.js';
import { ATSClientRegistry } from '../../ats/services/a-t-s-client.registry.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { CompanyPostingService } from '../../discovery/services/company-posting.service.js';
import { isNoFetchURL } from '../../job-mail/helpers/job-mail-link.helper.js';
import { VacancyMatchingService } from '../../matching/services/vacancy-matching.service.js';
import type { SourceRowType } from '../../search/interfaces/source-row.interface.js';
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
 * Skip reason of a vacancy from a job mail whose site refused the crawler — the job mail source is not stopped by it
 *
 * @type {string}
 */
const SITE_REFUSED_SKIP_REASON = 'the site of the vacancy refused the crawler (403, 429 or a challenge)';

/**
 * Reason a vacancy of a site the crawler never opens waits with: its company board has not shown it yet
 *
 * @type {string}
 */
const NO_TEXT_REASON = 'no description yet: the vacancy is not on a board of its company (Comeet, Greenhouse, Lever)';

/**
 * Milliseconds in a day
 *
 * @type {number}
 */
const DAY_MS = 24 * 60 * 60 * 1000;

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
 * Extracts a vacancy from its page: fetched politely in the mode of its source (a vacancy of an `ats` source from its
 * posting on the board; a vacancy of a site the crawler never opens — LinkedIn, Glassdoor — from the same position
 * found on a board of its company, or not at all), reduced to text, hashed — the same
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
   * @param {CompanyPostingService} companyPostingService
   * @param {ATSClientRegistry} atsClientRegistry
   * @param {VacancyExtractionService} vacancyExtractionService
   * @param {VacancyMatchingService} vacancyMatchingService
   * @param {PipelineEventsService} pipelineEventsService
   * @param {VacancyRepository} vacancyRepository
   * @param {SourceRepository} sourceRepository
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly companyPostingService: CompanyPostingService,
    private readonly atsClientRegistry: ATSClientRegistry,
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

    const readable = await this.withText(vacancy);

    if (!readable) {
      return { vacancyId, outcome: VacancyExtractionOutcomeEnum.NO_TEXT };
    }

    const page = await this.fetchVacancy(readable);

    if (page.outcome) {
      return { vacancyId, outcome: page.outcome };
    }

    return this.processPage(readable, page.html);
  }

  /**
   * The vacancy ready to be read. A vacancy of a site the crawler never opens is read from the same position on a board
   * of its company: looked up once, then again after `JOB_MAIL_TEXT_RECHECK_DAYS`, at most `JOB_MAIL_TEXT_MAX_SEARCHES`
   * times; until it is found the vacancy waits as `listed` with the reason, and no card is sent
   *
   * @param {VacancyRowType} vacancy
   *
   * @throws {Error} `BRAVE_SEARCH_*` from the web search — retried, except a refused key
   *
   * @returns {Promise<VacancyRowType | undefined>} Undefined when there is nothing to read yet
   */
  private async withText(vacancy: VacancyRowType): Promise<VacancyRowType | undefined> {
    if (vacancy.vacancy_text_url || !isNoFetchURL(vacancy.vacancy_url)) {
      return vacancy;
    }

    const now = new Date();
    const dueAfter = now.getTime() - this.configService.get('JOB_MAIL_TEXT_RECHECK_DAYS', { infer: true }) * DAY_MS;
    const isDue =
      vacancy.vacancy_text_searches < this.configService.get('JOB_MAIL_TEXT_MAX_SEARCHES', { infer: true }) &&
      (!vacancy.vacancy_text_searched_at || vacancy.vacancy_text_searched_at.getTime() < dueAfter);

    if (!isDue || !this.companyPostingService.isEnabled()) {
      await this.vacancyRepository.update(vacancy.vacancy_id, { vacancy_skip_reason: NO_TEXT_REASON });

      return undefined;
    }

    const posting = await this.companyPostingService.find(vacancy);
    const searched = { vacancy_text_searched_at: now, vacancy_text_searches: vacancy.vacancy_text_searches + 1 };

    if (!posting) {
      await this.vacancyRepository.update(vacancy.vacancy_id, { ...searched, vacancy_skip_reason: NO_TEXT_REASON });
      this.logger.debug({ message: 'Company posting not found', vacancyId: vacancy.vacancy_id, searches: searched.vacancy_text_searches });

      return undefined;
    }

    const found = { ...searched, vacancy_text_url: posting.url, vacancy_external_id: posting.externalId, vacancy_skip_reason: null };

    await this.vacancyRepository.update(vacancy.vacancy_id, found);

    return { ...vacancy, ...found };
  }

  /**
   * Fetch the vacancy in the way of its source — its page, or its posting on the board of an `ats` source; a vacancy
   * that is gone is closed, a page robots.txt forbids is skipped, a refusal of the site stops the source
   *
   * @param {VacancyRowType} vacancy
   *
   * @throws {CrawlError} For a transient failure, or after the source is stopped
   * @throws {Error} `ATS_POSTING_UNKNOWN` or `ATS_RESPONSE_INVALID` for a vacancy of an `ats` source
   *
   * @returns {Promise<{ html: string; outcome?: undefined } | { outcome: VacancyExtractionOutcomeEnum }>}
   */
  private async fetchVacancy(
    vacancy: VacancyRowType
  ): Promise<{ html: string; outcome?: undefined } | { outcome: VacancyExtractionOutcomeEnum }> {
    const source = await this.sourceRepository.findOne(vacancy.source_id);

    try {
      return { html: await this.loadVacancy(vacancy, source) };
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

      if (error.code === CrawlErrorCodeEnum.SOURCE_BLOCKED && source?.source_fetch_mode === SourceFetchModeEnum.JOB_MAIL) {
        await this.vacancyRepository.update(vacancy.vacancy_id, {
          vacancy_stage: VacancyStageEnum.SKIPPED,
          vacancy_skip_reason: SITE_REFUSED_SKIP_REASON
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
   * The HTML of a vacancy: the posting from a board — of an `ats` source, or the company board a vacancy of a site the
   * crawler never opens was found on —, the page fetched in the mode of the source otherwise; a job mail source reads
   * its vacancy pages as plain HTML
   *
   * @param {VacancyRowType} vacancy
   * @param {SourceRowType | undefined} source
   *
   * @throws {CrawlError} If the page or the posting was not fetched
   * @throws {Error} `ATS_POSTING_UNKNOWN` if the source URL is not a board or the vacancy has no position id
   * @throws {Error} `ATS_RESPONSE_INVALID` if the posting does not match its schema
   *
   * @returns {Promise<string>}
   */
  private async loadVacancy(vacancy: VacancyRowType, source: SourceRowType | undefined): Promise<string> {
    if (vacancy.vacancy_text_url) {
      return this.loadPosting(vacancy, vacancy.vacancy_text_url, vacancy.vacancy_text_url);
    }

    if (source?.source_fetch_mode !== SourceFetchModeEnum.ATS) {
      const mode = !source || source.source_fetch_mode === SourceFetchModeEnum.JOB_MAIL ? SOURCE_FALLBACK_MODE : source.source_fetch_mode;
      const page = await this.crawlerService.fetchPage(vacancy.vacancy_url, mode);

      return page.html;
    }

    return this.loadPosting(vacancy, source.source_url, vacancy.vacancy_url);
  }

  /**
   * The posting of a vacancy on a board
   *
   * @param {VacancyRowType} vacancy
   * @param {string} boardURL Any link to the board or to one of its positions
   * @param {string} url Address of the posting
   *
   * @throws {CrawlError} If the posting was not fetched
   * @throws {Error} `ATS_POSTING_UNKNOWN` if the link is not a board or the vacancy has no position id
   * @throws {Error} `ATS_RESPONSE_INVALID` if the posting does not match its schema
   *
   * @returns {Promise<string>}
   */
  private async loadPosting(vacancy: VacancyRowType, boardURL: string, url: string): Promise<string> {
    const board = parseATSBoard(boardURL);

    if (!board || !vacancy.vacancy_external_id) {
      throw new Error(`ATS_POSTING_UNKNOWN: vacancy ${vacancy.vacancy_id} of source ${vacancy.source_id} has no board or position id`);
    }

    return this.atsClientRegistry.findOne(board.kind).fetchPosting({ board: board.board, externalId: vacancy.vacancy_external_id, url });
  }

  /**
   * Extract and store the text of a fetched vacancy, unless it has not changed
   *
   * @param {VacancyRowType} vacancy
   * @param {string} html
   *
   * @returns {Promise<IVacancyExtractionSummary>}
   */
  private async processPage(vacancy: VacancyRowType, html: string): Promise<IVacancyExtractionSummary> {
    const vacancyId = vacancy.vacancy_id;
    const text = vacancyPageText(html, this.configService.get('VACANCY_TEXT_MAX_CHARS', { infer: true }));
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
