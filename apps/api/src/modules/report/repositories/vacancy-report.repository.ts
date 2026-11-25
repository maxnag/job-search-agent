import { Injectable } from '@nestjs/common';
import { type SQL, and, asc, eq, exists, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm';

import { profiles, resumes, sources, vacancies, vacancyMatches } from '@job-agent/db';
import { VacancyStageEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';
import type { IVacancyReportFilter } from '../interfaces/vacancy-report-filter.interface.js';
import type { IVacancyReportData } from '../interfaces/vacancy-report.interface.js';

/**
 * Characters `LIKE` reads as wildcards or as its escape
 *
 * @type {RegExp}
 */
const LIKE_SPECIAL = /[\\%_]/g;

/**
 * Reads what the report of the vacancies shows
 */
@Injectable()
export class VacancyReportRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Sources, the vacancies of theirs the filter selects and the verdicts of those vacancies against the current resume
   * versions; closed vacancies only when the filter asks for them
   *
   * @param {IVacancyReportFilter} [filter]
   *
   * @returns {Promise<IVacancyReportData>}
   */
  async findAll(filter: IVacancyReportFilter = {}): Promise<IVacancyReportData> {
    const { db } = this.databaseService;
    const bySource = filter.sourceIds?.length ? inArray(sources.source_id, [...filter.sourceIds]) : undefined;
    const ranked = db
      .select({
        vacancyId: vacancies.vacancy_id,
        sourceId: vacancies.source_id,
        title: vacancies.vacancy_title,
        company: vacancies.vacancy_company,
        city: vacancies.vacancy_city,
        country: vacancies.vacancy_country,
        workMode: vacancies.vacancy_work_mode,
        stage: vacancies.vacancy_stage,
        skipReason: vacancies.vacancy_skip_reason,
        url: vacancies.vacancy_url,
        textURL: vacancies.vacancy_text_url,
        firstSeenAt: vacancies.vacancy_first_seen_at,
        rank: sql<number>`row_number() over (partition by ${vacancies.source_id} order by ${vacancies.vacancy_id} desc)`.as('vacancy_rank')
      })
      .from(vacancies)
      .where(and(...this.vacancyConditions(filter)))
      .as('ranked');
    const withinLimit = filter.limit === undefined ? undefined : lte(ranked.rank, filter.limit);
    const [sourceRows, vacancyRows, matchRows] = await Promise.all([
      db
        .select({
          sourceId: sources.source_id,
          name: sources.source_name,
          url: sources.source_url,
          fetchMode: sources.source_fetch_mode,
          isActive: sources.source_is_active,
          status: sources.source_status,
          lastScanAt: sources.source_last_scan_at,
          lastError: sources.source_last_error
        })
        .from(sources)
        .where(bySource)
        .orderBy(asc(sources.source_id)),
      db
        .select({
          vacancyId: ranked.vacancyId,
          sourceId: ranked.sourceId,
          title: ranked.title,
          company: ranked.company,
          city: ranked.city,
          country: ranked.country,
          workMode: ranked.workMode,
          stage: ranked.stage,
          skipReason: ranked.skipReason,
          url: ranked.url,
          textURL: ranked.textURL,
          firstSeenAt: ranked.firstSeenAt
        })
        .from(ranked)
        .where(withinLimit)
        .orderBy(asc(ranked.vacancyId)),
      db
        .select({
          vacancyId: vacancyMatches.vacancy_id,
          profileName: profiles.profile_name,
          verdict: vacancyMatches.vacancy_match_verdict,
          reasons: vacancyMatches.vacancy_match_reasons
        })
        .from(vacancyMatches)
        .innerJoin(resumes, and(eq(resumes.resume_id, vacancyMatches.resume_id), sql`${resumes.resume_is_current}`))
        .innerJoin(profiles, eq(profiles.profile_id, resumes.profile_id))
        .where(inArray(vacancyMatches.vacancy_id, db.select({ vacancyId: ranked.vacancyId }).from(ranked).where(withinLimit)))
        .orderBy(asc(profiles.profile_name))
    ]);

    return {
      sources: sourceRows,
      vacancies: vacancyRows,
      matches: matchRows.map(row => ({ ...row, reasons: row.reasons as unknown as IMatchReason[] }))
    };
  }

  /**
   * The conditions of the filter on a vacancy row
   *
   * @param {IVacancyReportFilter} filter
   *
   * @returns {(SQL | undefined)[]}
   */
  private vacancyConditions(filter: IVacancyReportFilter): (SQL | undefined)[] {
    const showsClosed = filter.closed === true || filter.stages?.includes(VacancyStageEnum.CLOSED) === true;

    return [
      filter.sourceIds?.length ? inArray(vacancies.source_id, [...filter.sourceIds]) : undefined,
      filter.stages?.length ? inArray(vacancies.vacancy_stage, [...filter.stages]) : undefined,
      showsClosed ? undefined : ne(vacancies.vacancy_stage, VacancyStageEnum.CLOSED),
      filter.verdicts?.length ? this.currentMatch(inArray(vacancyMatches.vacancy_match_verdict, [...filter.verdicts])) : undefined,
      filter.reason === undefined ? undefined : this.reasonCondition(filter.reason),
      filter.country === undefined ? undefined : eq(vacancies.vacancy_country, filter.country.toUpperCase()),
      filter.workMode === undefined ? undefined : eq(vacancies.vacancy_work_mode, filter.workMode),
      filter.title === undefined ? undefined : ilike(vacancies.vacancy_title, this.containing(filter.title)),
      filter.company === undefined ? undefined : ilike(vacancies.vacancy_company, this.containing(filter.company)),
      filter.sinceDays === undefined
        ? undefined
        : gte(vacancies.vacancy_first_seen_at, sql`now() - make_interval(days => ${filter.sinceDays})`)
    ];
  }

  /**
   * The skip reason, or a finding of a verdict against a current resume, contains the text
   *
   * @param {string} text
   *
   * @returns {SQL | undefined}
   */
  private reasonCondition(text: string): SQL | undefined {
    const pattern = this.containing(text);

    return or(
      ilike(vacancies.vacancy_skip_reason, pattern),
      this.currentMatch(
        sql`exists (select 1 from jsonb_array_elements(${vacancyMatches.vacancy_match_reasons}) as finding where finding ->> 'message' ilike ${pattern})`
      )
    );
  }

  /**
   * The vacancy has a verdict against the current resume of some profile that meets the condition
   *
   * @param {SQL} condition
   *
   * @returns {SQL}
   */
  private currentMatch(condition: SQL): SQL {
    return exists(
      this.databaseService.db
        .select({ vacancyId: vacancyMatches.vacancy_id })
        .from(vacancyMatches)
        .innerJoin(resumes, and(eq(resumes.resume_id, vacancyMatches.resume_id), sql`${resumes.resume_is_current}`))
        .where(and(eq(vacancyMatches.vacancy_id, vacancies.vacancy_id), condition))
    );
  }

  /**
   * A `LIKE` pattern of the text anywhere, its wildcards taken literally
   *
   * @param {string} text
   *
   * @returns {string}
   */
  private containing(text: string): string {
    return `%${text.replace(LIKE_SPECIAL, '\\$&')}%`;
  }
}
