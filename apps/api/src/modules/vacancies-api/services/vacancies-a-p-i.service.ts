import { Injectable, NotFoundException } from '@nestjs/common';

import {
  type IVacancyActionAnswer,
  type IVacancyCard,
  type IVacancyCardExtraction,
  type IVacancyFilterOptions,
  type IVacancyListPage,
  type VacancyActionKindEnum,
  VacancyMatchVerdictEnum
} from '@job-agent/shared';

import { JobsDBRepository } from '../../jobs-db/repositories/jobs-db.repository.js';
import { readVacancyData } from '../../matching/helpers/vacancy-data.helper.js';
import { VacancyActionService } from '../../notify/services/vacancy-action.service.js';
import { VacancyReportRepository } from '../../report/repositories/vacancy-report.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { VacanciesAPIErrorCodeEnum } from '../enums/vacancies-a-p-i-error-code.enum.js';
import { VacancyFilterOptionsRepository } from '../repositories/vacancy-filter-options.repository.js';
import type { VacancyListQueryType } from '../schemas/vacancy-list-query.schema.js';

/**
 * What the web UI reads and writes about the vacancies: the list, the values of its filters, the card, the choices
 */
@Injectable()
export class VacanciesAPIService {
  /**
   * @param {VacancyActionService} vacancyActionService
   * @param {PipelineEventsService} pipelineEventsService
   * @param {VacancyReportRepository} vacancyReportRepository
   * @param {JobsDBRepository} jobsDBRepository
   * @param {VacancyFilterOptionsRepository} vacancyFilterOptionsRepository
   */
  constructor(
    private readonly vacancyActionService: VacancyActionService,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly vacancyReportRepository: VacancyReportRepository,
    private readonly jobsDBRepository: JobsDBRepository,
    private readonly vacancyFilterOptionsRepository: VacancyFilterOptionsRepository
  ) {}

  /**
   * One page of the vacancies the query selects
   *
   * @param {VacancyListQueryType} query
   *
   * @returns {Promise<IVacancyListPage>}
   */
  async findAll(query: VacancyListQueryType): Promise<IVacancyListPage> {
    const { page, pageSize, sort, order, stage, verdict, sourceId, country, level, lastAction, q, ...filter } = query;
    const report = await this.vacancyReportRepository.findPage(
      {
        ...filter,
        stages: stage,
        verdicts: verdict,
        sourceIds: sourceId,
        countries: country,
        levels: level,
        lastActions: lastAction,
        query: q
      },
      { page, pageSize, sort, order }
    );
    const matches = Map.groupBy(report.matches, match => match.vacancyId);

    return {
      total: report.total,
      page,
      pageSize,
      vacancies: report.vacancies.map(vacancy => ({
        vacancyId: vacancy.vacancyId,
        title: vacancy.title,
        company: vacancy.company,
        city: vacancy.city,
        country: vacancy.country,
        workMode: vacancy.workMode,
        level: vacancy.level,
        stage: vacancy.stage,
        source: vacancy.sourceName,
        firstSeenAt: vacancy.firstSeenAt.toISOString(),
        lastAction: vacancy.lastAction,
        verdicts: (matches.get(vacancy.vacancyId) ?? []).map(match => ({
          profile: match.profileName,
          verdict: match.verdict,
          findings: match.reasons.filter(reason => reason.effect !== VacancyMatchVerdictEnum.FIT).map(reason => reason.message)
        }))
      }))
    };
  }

  /**
   * The values the filters of the list offer
   *
   * @returns {Promise<IVacancyFilterOptions>}
   */
  async findFilterOptions(): Promise<IVacancyFilterOptions> {
    return this.vacancyFilterOptionsRepository.findAll();
  }

  /**
   * A vacancy with its extraction, verdicts and the owner's choices
   *
   * @param {number} vacancyId
   *
   * @throws {NotFoundException} `VACANCY_NOT_FOUND` if there is no such vacancy
   *
   * @returns {Promise<IVacancyCard>}
   */
  async findOne(vacancyId: number): Promise<IVacancyCard> {
    const [vacancy, matches, actions] = await Promise.all([
      this.jobsDBRepository.findVacancy(vacancyId),
      this.jobsDBRepository.findVacancyMatches(vacancyId),
      this.jobsDBRepository.findVacancyActions(vacancyId)
    ]);

    if (!vacancy) {
      throw this.notFound(vacancyId);
    }

    return {
      vacancyId: vacancy.vacancyId,
      title: vacancy.title,
      company: vacancy.company,
      city: vacancy.city,
      country: vacancy.country,
      workMode: vacancy.workMode,
      level: vacancy.level,
      stage: vacancy.stage,
      skipReason: vacancy.skipReason,
      source: vacancy.sourceName,
      url: vacancy.url,
      textURL: vacancy.textURL,
      firstSeenAt: vacancy.firstSeenAt.toISOString(),
      lastSeenAt: vacancy.lastSeenAt.toISOString(),
      closedAt: vacancy.closedAt?.toISOString() ?? null,
      extraction: this.extraction(vacancy.data),
      matches: matches.map(match => ({
        profile: match.profileName,
        verdict: match.verdict,
        findings: match.reasons.map(reason => ({ rule: reason.rule, effect: reason.effect, message: reason.message })),
        notifiedAt: match.notifiedAt?.toISOString() ?? null
      })),
      actions: actions.map(action => ({ kind: action.kind, at: action.at.toISOString() }))
    };
  }

  /**
   * Store the owner's choice about a vacancy and queue it to be shown under its Telegram messages
   *
   * @param {number} vacancyId
   * @param {VacancyActionKindEnum} kind
   *
   * @throws {NotFoundException} `VACANCY_NOT_FOUND` if there is no such vacancy
   *
   * @returns {Promise<IVacancyActionAnswer>}
   */
  async recordAction(vacancyId: number, kind: VacancyActionKindEnum): Promise<IVacancyActionAnswer> {
    const vacancy = await this.jobsDBRepository.findVacancy(vacancyId);

    if (!vacancy) {
      throw this.notFound(vacancyId);
    }

    const recorded = await this.vacancyActionService.record(vacancyId, kind);

    if (recorded) {
      await this.pipelineEventsService.vacancyActionRecorded(vacancyId);
    }

    return { kind, recorded };
  }

  /**
   * The fields of the extraction the card shows; none before the extraction ran
   *
   * @param {Record<string, unknown> | null} data
   *
   * @returns {IVacancyCardExtraction | null}
   */
  private extraction(data: Record<string, unknown> | null): IVacancyCardExtraction | null {
    const vacancy = readVacancyData(data);

    if (!vacancy) {
      return null;
    }

    return {
      summary: vacancy.summary,
      programmingLanguages: [
        ...vacancy.requiredLanguages.map(language => ({ name: language.name, required: true })),
        ...vacancy.preferredLanguages.map(language => ({ name: language.name, required: false }))
      ],
      frameworks: vacancy.frameworks.map(framework => framework.name),
      yearsRequired: vacancy.yearsRequired,
      hebrew: vacancy.hebrew
    };
  }

  /**
   * The answer for a vacancy that does not exist
   *
   * @param {number} vacancyId
   *
   * @returns {NotFoundException}
   */
  private notFound(vacancyId: number): NotFoundException {
    return new NotFoundException({ code: VacanciesAPIErrorCodeEnum.VACANCY_NOT_FOUND, message: `There is no vacancy ${vacancyId}` });
  }
}
