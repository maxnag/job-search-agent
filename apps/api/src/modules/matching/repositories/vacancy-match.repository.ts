import { Injectable } from '@nestjs/common';
import { and, eq, isNotNull, min } from 'drizzle-orm';

import { resumes, vacancies, vacancyMatches } from '@job-agent/db';
import { VacancyStageEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import type { IStoredVacancyMatch, IVacancyMatchWrite } from '../interfaces/vacancy-match-write.interface.js';

/**
 * Data access of the verdicts
 */
@Injectable()
export class VacancyMatchRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Store the verdict of a vacancy against a resume version, replacing the previous one of the same pair; when the
   * card was sent is kept, so a recount never sends it again
   *
   * @param {IVacancyMatchWrite} match
   *
   * @throws {Error} `VACANCY_MATCH_NOT_STORED` if the row was not written
   *
   * @returns {Promise<IStoredVacancyMatch>}
   */
  async upsert(match: IVacancyMatchWrite): Promise<IStoredVacancyMatch> {
    const values = { vacancy_match_verdict: match.verdict, vacancy_match_reasons: match.reasons.map(reason => ({ ...reason })) };
    const [row] = await this.databaseService.db
      .insert(vacancyMatches)
      .values({ vacancy_id: match.vacancyId, resume_id: match.resumeId, ...values })
      .onConflictDoUpdate({ target: [vacancyMatches.vacancy_id, vacancyMatches.resume_id], set: values })
      .returning({
        vacancyMatchId: vacancyMatches.vacancy_match_id,
        verdict: vacancyMatches.vacancy_match_verdict,
        notifiedAt: vacancyMatches.vacancy_match_notified_at
      });

    if (!row) {
      throw new Error(`VACANCY_MATCH_NOT_STORED: vacancy ${match.vacancyId}, resume ${match.resumeId}`);
    }

    return row;
  }

  /**
   * When the owner first got a card for each vacancy of a profile, with any of its resume versions
   *
   * @param {number} profileId
   *
   * @returns {Promise<ReadonlyMap<number, Date>>}
   */
  async findNotifiedAt(profileId: number): Promise<ReadonlyMap<number, Date>> {
    const rows = await this.databaseService.db
      .select({ vacancyId: vacancyMatches.vacancy_id, notifiedAt: min(vacancyMatches.vacancy_match_notified_at) })
      .from(vacancyMatches)
      .innerJoin(resumes, eq(resumes.resume_id, vacancyMatches.resume_id))
      .where(and(eq(resumes.profile_id, profileId), isNotNull(vacancyMatches.vacancy_match_notified_at)))
      .groupBy(vacancyMatches.vacancy_id);

    return new Map(rows.filter(row => row.notifiedAt !== null).map(row => [row.vacancyId, row.notifiedAt as Date]));
  }

  /**
   * Mark a verdict as told — its card was sent at the given time
   *
   * @param {number} vacancyMatchId
   * @param {Date} notifiedAt
   *
   * @returns {Promise<void>}
   */
  async markNotified(vacancyMatchId: number, notifiedAt: Date): Promise<void> {
    await this.databaseService.db
      .update(vacancyMatches)
      .set({ vacancy_match_notified_at: notifiedAt })
      .where(eq(vacancyMatches.vacancy_match_id, vacancyMatchId));
  }

  /**
   * Every extracted vacancy that is still open — what a new resume version is matched against
   *
   * @returns {Promise<VacancyRowType[]>}
   */
  async findExtractedVacancies(): Promise<VacancyRowType[]> {
    return this.databaseService.db.select().from(vacancies).where(eq(vacancies.vacancy_stage, VacancyStageEnum.EXTRACTED));
  }
}
