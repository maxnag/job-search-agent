import { Injectable } from '@nestjs/common';
import { and, eq, exists, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';

import { vacancies, vacancyActions, vacancyMatches } from '@job-agent/db';
import { VacancyStageEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { IListingScanPlan, IListingScanResult } from '../interfaces/listing-scan-plan.interface.js';
import type { VacancyRowType, VacancyUpdateType } from '../interfaces/vacancy-row.interface.js';

/**
 * Data access of the vacancies
 */
@Injectable()
export class VacancyRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Vacancy by its id
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<VacancyRowType | undefined>}
   */
  async findOne(vacancyId: number): Promise<VacancyRowType | undefined> {
    const [row] = await this.databaseService.db.select().from(vacancies).where(eq(vacancies.vacancy_id, vacancyId)).limit(1);

    return row;
  }

  /**
   * Write columns of one vacancy
   *
   * @param {number} vacancyId
   * @param {VacancyUpdateType} values
   *
   * @returns {Promise<void>}
   */
  async update(vacancyId: number, values: VacancyUpdateType): Promise<void> {
    await this.databaseService.db.update(vacancies).set(values).where(eq(vacancies.vacancy_id, vacancyId));
  }

  /**
   * Close a vacancy that is gone
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<void>}
   */
  async close(vacancyId: number): Promise<void> {
    await this.update(vacancyId, { vacancy_stage: VacancyStageEnum.CLOSED, vacancy_closed_at: new Date() });
  }

  /**
   * Vacancies known by any of the URLs or dedup keys — from any source
   *
   * @param {readonly string[]} urls
   * @param {readonly string[]} dedupKeys
   *
   * @returns {Promise<VacancyRowType[]>}
   */
  async findKnown(urls: readonly string[], dedupKeys: readonly string[]): Promise<VacancyRowType[]> {
    if (urls.length === 0 && dedupKeys.length === 0) {
      return [];
    }

    return this.databaseService.db
      .select()
      .from(vacancies)
      .where(or(inArray(vacancies.vacancy_url, [...urls]), inArray(vacancies.vacancy_dedup_key, [...dedupKeys])));
  }

  /**
   * Vacancies of a source that are not closed
   *
   * @param {number} sourceId
   *
   * @returns {Promise<VacancyRowType[]>}
   */
  async findOpenBySource(sourceId: number): Promise<VacancyRowType[]> {
    return this.databaseService.db
      .select()
      .from(vacancies)
      .where(and(eq(vacancies.source_id, sourceId), ne(vacancies.vacancy_stage, VacancyStageEnum.CLOSED)));
  }

  /**
   * Write a scan in one transaction: insert the new vacancies (a row that appeared meanwhile is left as it is),
   * update the ones seen again, close the ones gone
   *
   * @param {IListingScanPlan} plan
   *
   * @returns {Promise<IListingScanResult>}
   */
  async applyScan(plan: IListingScanPlan): Promise<IListingScanResult> {
    return this.databaseService.db.transaction(async tx => {
      const created =
        plan.inserts.length > 0
          ? await tx
              .insert(vacancies)
              .values([...plan.inserts])
              .onConflictDoNothing()
              .returning({ vacancyId: vacancies.vacancy_id, stage: vacancies.vacancy_stage })
          : [];
      const updated = [];

      for (const update of plan.updates) {
        const [row] = await tx
          .update(vacancies)
          .set(update.values)
          .where(eq(vacancies.vacancy_id, update.vacancyId))
          .returning({ vacancyId: vacancies.vacancy_id, stage: vacancies.vacancy_stage });

        if (row) {
          updated.push(row);
        }
      }

      const closed =
        plan.closeIds.length > 0
          ? await tx
              .update(vacancies)
              .set({ vacancy_stage: VacancyStageEnum.CLOSED, vacancy_closed_at: sql`now()` })
              .where(inArray(vacancies.vacancy_id, [...plan.closeIds]))
              .returning({ vacancyId: vacancies.vacancy_id })
          : [];

      return { created, updated, closedIds: closed.map(row => row.vacancyId) };
    });
  }

  /**
   * The vacancies among the given ones the owner has heard of: a card was sent or a button pressed
   *
   * @param {readonly number[]} vacancyIds
   *
   * @returns {Promise<number[]>}
   */
  async findNotifiedIds(vacancyIds: readonly number[]): Promise<number[]> {
    if (vacancyIds.length === 0) {
      return [];
    }

    const { db } = this.databaseService;
    const rows = await db
      .select({ vacancyId: vacancies.vacancy_id })
      .from(vacancies)
      .where(
        and(
          inArray(vacancies.vacancy_id, [...vacancyIds]),
          or(
            exists(
              db
                .select({ id: vacancyMatches.vacancy_match_id })
                .from(vacancyMatches)
                .where(and(eq(vacancyMatches.vacancy_id, vacancies.vacancy_id), isNotNull(vacancyMatches.vacancy_match_notified_at)))
            ),
            exists(
              db
                .select({ id: vacancyActions.vacancy_action_id })
                .from(vacancyActions)
                .where(eq(vacancyActions.vacancy_id, vacancies.vacancy_id))
            )
          )
        )
      );

    return rows.map(row => row.vacancyId);
  }
}
