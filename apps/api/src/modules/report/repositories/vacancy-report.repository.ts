import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { profiles, resumes, sources, vacancies, vacancyMatches } from '@job-agent/db';

import { DatabaseService } from '../../database/services/database.service.js';
import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';
import type { IVacancyReportData } from '../interfaces/vacancy-report.interface.js';

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
   * Sources, every vacancy of theirs and the verdicts against the current resume versions — of one source, or all
   *
   * @param {number} [sourceId]
   *
   * @returns {Promise<IVacancyReportData>}
   */
  async findAll(sourceId?: number): Promise<IVacancyReportData> {
    const { db } = this.databaseService;
    const bySource = sourceId === undefined ? undefined : eq(sources.source_id, sourceId);
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
          vacancyId: vacancies.vacancy_id,
          sourceId: vacancies.source_id,
          title: vacancies.vacancy_title,
          city: vacancies.vacancy_city,
          country: vacancies.vacancy_country,
          workMode: vacancies.vacancy_work_mode,
          stage: vacancies.vacancy_stage,
          skipReason: vacancies.vacancy_skip_reason
        })
        .from(vacancies)
        .innerJoin(sources, eq(sources.source_id, vacancies.source_id))
        .where(bySource)
        .orderBy(asc(vacancies.vacancy_id)),
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
        .orderBy(asc(profiles.profile_name))
    ]);

    return {
      sources: sourceRows,
      vacancies: vacancyRows,
      matches: matchRows.map(row => ({ ...row, reasons: row.reasons as unknown as IMatchReason[] }))
    };
  }
}
