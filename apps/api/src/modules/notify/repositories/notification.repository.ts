import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { resumes, sources, vacancies, vacancyActions, vacancyMatches } from '@job-agent/db';
import { type VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';
import type { IMatchCard, ISourceNotice, IVacancyNotice } from '../interfaces/vacancy-notice.interface.js';

/**
 * Verdicts the owner gets a card for
 *
 * @type {readonly VacancyMatchVerdictEnum[]}
 */
const CARD_VERDICTS: readonly VacancyMatchVerdictEnum[] = [VacancyMatchVerdictEnum.FIT, VacancyMatchVerdictEnum.ALMOST];

/**
 * Columns of a vacancy a message shows
 *
 * @type {object}
 */
const VACANCY_COLUMNS = {
  vacancyId: vacancies.vacancy_id,
  title: vacancies.vacancy_title,
  company: vacancies.vacancy_company,
  city: vacancies.vacancy_city,
  country: vacancies.vacancy_country,
  workMode: vacancies.vacancy_work_mode,
  url: vacancies.vacancy_url,
  textURL: vacancies.vacancy_text_url,
  stage: vacancies.vacancy_stage
};

/**
 * Data access of the notifications: what a message shows, which cards are due, the buttons pressed
 */
@Injectable()
export class NotificationRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * A verdict with its vacancy
   *
   * @param {number} vacancyMatchId
   *
   * @returns {Promise<IMatchCard | undefined>}
   */
  async findMatchCard(vacancyMatchId: number): Promise<IMatchCard | undefined> {
    const [row] = await this.databaseService.db
      .select({
        ...VACANCY_COLUMNS,
        vacancyMatchId: vacancyMatches.vacancy_match_id,
        verdict: vacancyMatches.vacancy_match_verdict,
        reasons: vacancyMatches.vacancy_match_reasons,
        notifiedAt: vacancyMatches.vacancy_match_notified_at,
        isCurrentResume: resumes.resume_is_current
      })
      .from(vacancyMatches)
      .innerJoin(vacancies, eq(vacancies.vacancy_id, vacancyMatches.vacancy_id))
      .innerJoin(resumes, eq(resumes.resume_id, vacancyMatches.resume_id))
      .where(eq(vacancyMatches.vacancy_match_id, vacancyMatchId))
      .limit(1);

    return row ? { ...row, reasons: row.reasons as unknown as IMatchReason[] } : undefined;
  }

  /**
   * A vacancy with its latest verdict against a current resume version, if any
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<IVacancyNotice | undefined>}
   */
  async findVacancyNotice(vacancyId: number): Promise<IVacancyNotice | undefined> {
    const [row] = await this.databaseService.db
      .select({ ...VACANCY_COLUMNS, verdict: vacancyMatches.vacancy_match_verdict, reasons: vacancyMatches.vacancy_match_reasons })
      .from(vacancies)
      .leftJoin(vacancyMatches, eq(vacancyMatches.vacancy_id, vacancies.vacancy_id))
      .leftJoin(resumes, and(eq(resumes.resume_id, vacancyMatches.resume_id), sql`${resumes.resume_is_current}`))
      .where(eq(vacancies.vacancy_id, vacancyId))
      .orderBy(sql`${resumes.resume_id} IS NULL`, desc(vacancyMatches.vacancy_match_id))
      .limit(1);

    return row ? { ...row, reasons: (row.reasons ?? []) as unknown as IMatchReason[] } : undefined;
  }

  /**
   * `fit` and `almost` verdicts against current resume versions of open extracted vacancies whose card was not sent
   *
   * @returns {Promise<number[]>}
   */
  async findPendingMatchIds(): Promise<number[]> {
    const rows = await this.databaseService.db
      .select({ vacancyMatchId: vacancyMatches.vacancy_match_id })
      .from(vacancyMatches)
      .innerJoin(vacancies, eq(vacancies.vacancy_id, vacancyMatches.vacancy_id))
      .innerJoin(resumes, eq(resumes.resume_id, vacancyMatches.resume_id))
      .where(
        and(
          isNull(vacancyMatches.vacancy_match_notified_at),
          inArray(vacancyMatches.vacancy_match_verdict, [...CARD_VERDICTS]),
          sql`${resumes.resume_is_current}`,
          eq(vacancies.vacancy_stage, VacancyStageEnum.EXTRACTED)
        )
      )
      .orderBy(vacancyMatches.vacancy_match_id);

    return rows.map(row => row.vacancyMatchId);
  }

  /**
   * The card of a verdict was sent
   *
   * @param {number} vacancyMatchId
   *
   * @returns {Promise<void>}
   */
  async markNotified(vacancyMatchId: number): Promise<void> {
    await this.databaseService.db
      .update(vacancyMatches)
      .set({ vacancy_match_notified_at: sql`now()` })
      .where(eq(vacancyMatches.vacancy_match_id, vacancyMatchId));
  }

  /**
   * A source with what the crawler noted
   *
   * @param {number} sourceId
   *
   * @returns {Promise<ISourceNotice | undefined>}
   */
  async findSourceNotice(sourceId: number): Promise<ISourceNotice | undefined> {
    const [row] = await this.databaseService.db
      .select({ name: sources.source_name, url: sources.source_url, status: sources.source_status, error: sources.source_last_error })
      .from(sources)
      .where(eq(sources.source_id, sourceId))
      .limit(1);

    return row;
  }

  /**
   * Store a button the owner pressed
   *
   * @param {number} vacancyId
   * @param {VacancyActionKindEnum} kind
   * @param {number} messageId
   *
   * @returns {Promise<void>}
   */
  async createAction(vacancyId: number, kind: VacancyActionKindEnum, messageId: number): Promise<void> {
    await this.databaseService.db
      .insert(vacancyActions)
      .values({ vacancy_id: vacancyId, vacancy_action_kind: kind, vacancy_action_message_id: messageId });
  }
}
