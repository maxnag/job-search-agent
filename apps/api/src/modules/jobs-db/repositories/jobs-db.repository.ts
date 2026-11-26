import { Injectable } from '@nestjs/common';
import { type AnyColumn, type SQL, and, asc, count, desc, eq, gte, isNotNull, ne, sql } from 'drizzle-orm';

import { profiles, resumes, sourceCandidates, sources, vacancies, vacancyActions, vacancyMatches } from '@job-agent/db';
import { type SourceCandidateStatusEnum, VacancyStageEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { SourceCandidateRowType } from '../../discovery/interfaces/source-candidate-row.interface.js';
import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';
import type { IJobsDBApplication, IJobsDBApplicationFilter } from '../interfaces/jobs-db-application.interface.js';
import type { IJobsDBPipelineCounts } from '../interfaces/jobs-db-pipeline.interface.js';
import type { IJobsDBSource, IJobsDBSourceFilter } from '../interfaces/jobs-db-source.interface.js';
import type { IJobsDBVacancy, IJobsDBVacancyAction, IJobsDBVacancyMatch } from '../interfaces/jobs-db-vacancy.interface.js';

/**
 * Reads what the tools of the `jobs-db` MCP server answer with — the vacancies, the owner's choices, the sources
 */
@Injectable()
export class JobsDBRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * A vacancy with its source name and extracted fields
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<IJobsDBVacancy | undefined>}
   */
  async findVacancy(vacancyId: number): Promise<IJobsDBVacancy | undefined> {
    const [row] = await this.databaseService.db
      .select({
        vacancyId: vacancies.vacancy_id,
        sourceName: sources.source_name,
        title: vacancies.vacancy_title,
        company: vacancies.vacancy_company,
        city: vacancies.vacancy_city,
        country: vacancies.vacancy_country,
        workMode: vacancies.vacancy_work_mode,
        roleFamily: vacancies.vacancy_role_family,
        level: vacancies.vacancy_level,
        stage: vacancies.vacancy_stage,
        skipReason: vacancies.vacancy_skip_reason,
        url: vacancies.vacancy_url,
        textURL: vacancies.vacancy_text_url,
        data: vacancies.vacancy_data,
        firstSeenAt: vacancies.vacancy_first_seen_at,
        lastSeenAt: vacancies.vacancy_last_seen_at,
        closedAt: vacancies.vacancy_closed_at
      })
      .from(vacancies)
      .innerJoin(sources, eq(sources.source_id, vacancies.source_id))
      .where(eq(vacancies.vacancy_id, vacancyId))
      .limit(1);

    return row;
  }

  /**
   * The verdicts for a vacancy against the current resume of each profile
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<IJobsDBVacancyMatch[]>}
   */
  async findVacancyMatches(vacancyId: number): Promise<IJobsDBVacancyMatch[]> {
    const rows = await this.databaseService.db
      .select({
        profileName: profiles.profile_name,
        verdict: vacancyMatches.vacancy_match_verdict,
        reasons: vacancyMatches.vacancy_match_reasons,
        notifiedAt: vacancyMatches.vacancy_match_notified_at
      })
      .from(vacancyMatches)
      .innerJoin(resumes, and(eq(resumes.resume_id, vacancyMatches.resume_id), sql`${resumes.resume_is_current}`))
      .innerJoin(profiles, eq(profiles.profile_id, resumes.profile_id))
      .where(eq(vacancyMatches.vacancy_id, vacancyId))
      .orderBy(asc(profiles.profile_name));

    return rows.map(row => ({ ...row, reasons: row.reasons as unknown as IMatchReason[] }));
  }

  /**
   * The choices the owner made about a vacancy, oldest first
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<IJobsDBVacancyAction[]>}
   */
  async findVacancyActions(vacancyId: number): Promise<IJobsDBVacancyAction[]> {
    return this.databaseService.db
      .select({ kind: vacancyActions.vacancy_action_kind, at: vacancyActions.dt_create })
      .from(vacancyActions)
      .where(eq(vacancyActions.vacancy_id, vacancyId))
      .orderBy(asc(vacancyActions.vacancy_action_id));
  }

  /**
   * The vacancies the owner made a choice of the kind about, each once with its latest such choice, newest first
   *
   * @param {IJobsDBApplicationFilter} filter
   *
   * @returns {Promise<IJobsDBApplication[]>}
   */
  async findApplications(filter: IJobsDBApplicationFilter): Promise<IJobsDBApplication[]> {
    const rows = await this.databaseService.db
      .selectDistinctOn([vacancyActions.vacancy_id], {
        vacancyId: vacancies.vacancy_id,
        title: vacancies.vacancy_title,
        company: vacancies.vacancy_company,
        city: vacancies.vacancy_city,
        country: vacancies.vacancy_country,
        stage: vacancies.vacancy_stage,
        closedAt: vacancies.vacancy_closed_at,
        url: vacancies.vacancy_url,
        at: vacancyActions.dt_create
      })
      .from(vacancyActions)
      .innerJoin(vacancies, eq(vacancies.vacancy_id, vacancyActions.vacancy_id))
      .where(and(eq(vacancyActions.vacancy_action_kind, filter.kind), this.since(vacancyActions.dt_create, filter.sinceDays)))
      .orderBy(asc(vacancyActions.vacancy_id), desc(vacancyActions.vacancy_action_id));

    return rows.sort((left, right) => right.at.getTime() - left.at.getTime());
  }

  /**
   * The counters of the pipeline: vacancies first seen in the period by stage, verdict and source; choices made and
   * cards sent in the period. Without a period — over everything
   *
   * @param {number} [sinceDays]
   *
   * @returns {Promise<IJobsDBPipelineCounts>}
   */
  async countPipeline(sinceDays?: number): Promise<IJobsDBPipelineCounts> {
    const { db } = this.databaseService;
    const seen = this.since(vacancies.vacancy_first_seen_at, sinceDays);
    const [byStage, byVerdict, bySource, actions, [cards]] = await Promise.all([
      db
        .select({ stage: vacancies.vacancy_stage, count: count() })
        .from(vacancies)
        .where(seen)
        .groupBy(vacancies.vacancy_stage)
        .orderBy(asc(vacancies.vacancy_stage)),
      db
        .select({ profileName: profiles.profile_name, verdict: vacancyMatches.vacancy_match_verdict, count: count() })
        .from(vacancyMatches)
        .innerJoin(resumes, and(eq(resumes.resume_id, vacancyMatches.resume_id), sql`${resumes.resume_is_current}`))
        .innerJoin(profiles, eq(profiles.profile_id, resumes.profile_id))
        .innerJoin(vacancies, eq(vacancies.vacancy_id, vacancyMatches.vacancy_id))
        .where(seen)
        .groupBy(profiles.profile_name, vacancyMatches.vacancy_match_verdict)
        .orderBy(asc(profiles.profile_name), asc(vacancyMatches.vacancy_match_verdict)),
      db
        .select({ sourceId: sources.source_id, name: sources.source_name, count: count() })
        .from(vacancies)
        .innerJoin(sources, eq(sources.source_id, vacancies.source_id))
        .where(seen)
        .groupBy(sources.source_id)
        .orderBy(desc(count()), asc(sources.source_id)),
      db
        .select({ kind: vacancyActions.vacancy_action_kind, count: count() })
        .from(vacancyActions)
        .where(this.since(vacancyActions.dt_create, sinceDays))
        .groupBy(vacancyActions.vacancy_action_kind)
        .orderBy(asc(vacancyActions.vacancy_action_kind)),
      db
        .select({ count: count() })
        .from(vacancyMatches)
        .where(and(isNotNull(vacancyMatches.vacancy_match_notified_at), this.since(vacancyMatches.vacancy_match_notified_at, sinceDays)))
    ]);

    return { byStage, byVerdict, bySource, actions, cardsSent: cards?.count ?? 0 };
  }

  /**
   * Sources with the number of their open vacancies; only the switched-on ones unless asked otherwise
   *
   * @param {IJobsDBSourceFilter} filter
   *
   * @returns {Promise<IJobsDBSource[]>}
   */
  async findSources(filter: IJobsDBSourceFilter): Promise<IJobsDBSource[]> {
    return this.databaseService.db
      .select({
        sourceId: sources.source_id,
        name: sources.source_name,
        url: sources.source_url,
        fetchMode: sources.source_fetch_mode,
        isActive: sources.source_is_active,
        status: sources.source_status,
        lastScanAt: sources.source_last_scan_at,
        lastError: sources.source_last_error,
        openVacancies: count(vacancies.vacancy_id)
      })
      .from(sources)
      .leftJoin(vacancies, and(eq(vacancies.source_id, sources.source_id), ne(vacancies.vacancy_stage, VacancyStageEnum.CLOSED)))
      .where(
        and(
          filter.status === undefined ? undefined : eq(sources.source_status, filter.status),
          filter.includeInactive === true ? undefined : eq(sources.source_is_active, true)
        )
      )
      .groupBy(sources.source_id)
      .orderBy(asc(sources.source_id));
  }

  /**
   * Boards the discovery found, the latest checked first
   *
   * @param {SourceCandidateStatusEnum} [status]
   *
   * @returns {Promise<SourceCandidateRowType[]>}
   */
  async findSourceCandidates(status?: SourceCandidateStatusEnum): Promise<SourceCandidateRowType[]> {
    return this.databaseService.db
      .select()
      .from(sourceCandidates)
      .where(status === undefined ? undefined : eq(sourceCandidates.source_candidate_status, status))
      .orderBy(desc(sourceCandidates.source_candidate_checked_at), asc(sourceCandidates.source_candidate_id));
  }

  /**
   * The moment in the column is within the last days; no condition without a period
   *
   * @param {AnyColumn} column
   * @param {number} [sinceDays]
   *
   * @returns {SQL | undefined}
   */
  private since(column: AnyColumn, sinceDays?: number): SQL | undefined {
    return sinceDays === undefined ? undefined : gte(column, sql`now() - make_interval(days => ${sinceDays})`);
  }
}
