import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

import { resumes, sources, vacancies, vacancyActions, vacancyMatches, vacancyMessages } from '@job-agent/db';
import { type VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';
import type { IVacancyActionSync } from '../interfaces/vacancy-action-sync.interface.js';
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
 * Data access of the notifications: what a message shows, which cards are due, the buttons pressed, the messages that
 * carry the buttons of a vacancy
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
   * Store a choice of the owner unless it repeats the latest choice about the vacancy; a choice made without a card
   * has no message. The vacancy row is locked for the check, so two channels choosing at once store one row
   *
   * @param {number} vacancyId
   * @param {VacancyActionKindEnum} kind
   * @param {number} [messageId]
   *
   * @returns {Promise<boolean>} false when the latest choice was already this one
   */
  async createAction(vacancyId: number, kind: VacancyActionKindEnum, messageId?: number): Promise<boolean> {
    return this.databaseService.db.transaction(async tx => {
      await tx.select({ vacancyId: vacancies.vacancy_id }).from(vacancies).where(eq(vacancies.vacancy_id, vacancyId)).for('no key update');

      const [latest] = await tx
        .select({ kind: vacancyActions.vacancy_action_kind })
        .from(vacancyActions)
        .where(eq(vacancyActions.vacancy_id, vacancyId))
        .orderBy(desc(vacancyActions.vacancy_action_id))
        .limit(1);

      if (latest?.kind === kind) {
        return false;
      }

      await tx
        .insert(vacancyActions)
        .values({ vacancy_id: vacancyId, vacancy_action_kind: kind, vacancy_action_message_id: messageId ?? null });

      return true;
    });
  }

  /**
   * Remember a Telegram message that carries the buttons of a vacancy; a message already known is left as it is
   *
   * @param {number} vacancyId
   * @param {number} telegramMessageId
   *
   * @returns {Promise<void>}
   */
  async createMessage(vacancyId: number, telegramMessageId: number): Promise<void> {
    await this.databaseService.db
      .insert(vacancyMessages)
      .values({ vacancy_id: vacancyId, vacancy_message_telegram_id: telegramMessageId })
      .onConflictDoNothing();
  }

  /**
   * The Telegram messages that carry the buttons of a vacancy, oldest first
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<number[]>} Telegram message ids
   */
  async findMessageIds(vacancyId: number): Promise<number[]> {
    const rows = await this.databaseService.db
      .select({ telegramMessageId: vacancyMessages.vacancy_message_telegram_id })
      .from(vacancyMessages)
      .where(eq(vacancyMessages.vacancy_id, vacancyId))
      .orderBy(asc(vacancyMessages.vacancy_message_id));

    return rows.map(row => row.telegramMessageId);
  }

  /**
   * Forget a message Telegram no longer has
   *
   * @param {number} vacancyId
   * @param {number} telegramMessageId
   *
   * @returns {Promise<void>}
   */
  async deleteMessage(vacancyId: number, telegramMessageId: number): Promise<void> {
    await this.databaseService.db
      .delete(vacancyMessages)
      .where(and(eq(vacancyMessages.vacancy_id, vacancyId), eq(vacancyMessages.vacancy_message_telegram_id, telegramMessageId)));
  }

  /**
   * The latest choice about each vacancy that has a choice not shown under its messages yet — of one vacancy, or of all
   *
   * @param {number} [vacancyId]
   *
   * @returns {Promise<IVacancyActionSync[]>}
   */
  async findUnsyncedActions(vacancyId?: number): Promise<IVacancyActionSync[]> {
    const { db } = this.databaseService;
    const unsynced = db
      .select({ vacancyId: vacancyActions.vacancy_id })
      .from(vacancyActions)
      .where(
        and(isNull(vacancyActions.vacancy_action_synced_at), vacancyId === undefined ? undefined : eq(vacancyActions.vacancy_id, vacancyId))
      );

    return db
      .selectDistinctOn([vacancyActions.vacancy_id], {
        vacancyId: vacancyActions.vacancy_id,
        vacancyActionId: vacancyActions.vacancy_action_id,
        kind: vacancyActions.vacancy_action_kind
      })
      .from(vacancyActions)
      .where(inArray(vacancyActions.vacancy_id, unsynced))
      .orderBy(asc(vacancyActions.vacancy_id), desc(vacancyActions.vacancy_action_id));
  }

  /**
   * The choices about a vacancy up to the given one are shown under its messages
   *
   * @param {number} vacancyId
   * @param {number} vacancyActionId
   *
   * @returns {Promise<void>}
   */
  async markActionsSynced(vacancyId: number, vacancyActionId: number): Promise<void> {
    await this.databaseService.db
      .update(vacancyActions)
      .set({ vacancy_action_synced_at: sql`now()` })
      .where(
        and(
          eq(vacancyActions.vacancy_id, vacancyId),
          lte(vacancyActions.vacancy_action_id, vacancyActionId),
          isNull(vacancyActions.vacancy_action_synced_at)
        )
      );
  }
}
