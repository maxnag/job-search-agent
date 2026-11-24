import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { sourceCandidates } from '@job-agent/db';
import { SourceCandidateStatusEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { SourceCandidateInsertType, SourceCandidateRowType } from '../interfaces/source-candidate-row.interface.js';

/**
 * Data access of the company boards the discovery found
 */
@Injectable()
export class SourceCandidateRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Candidate by its id
   *
   * @param {number} sourceCandidateId
   *
   * @returns {Promise<SourceCandidateRowType | undefined>}
   */
  async findOne(sourceCandidateId: number): Promise<SourceCandidateRowType | undefined> {
    const [row] = await this.databaseService.db
      .select()
      .from(sourceCandidates)
      .where(eq(sourceCandidates.source_candidate_id, sourceCandidateId))
      .limit(1);

    return row;
  }

  /**
   * Store the owner's decision on a candidate, with the source it became
   *
   * @param {number} sourceCandidateId
   * @param {SourceCandidateStatusEnum} status
   * @param {number | null} sourceId
   *
   * @returns {Promise<void>}
   */
  async markDecided(sourceCandidateId: number, status: SourceCandidateStatusEnum, sourceId: number | null): Promise<void> {
    await this.databaseService.db
      .update(sourceCandidates)
      .set({ source_candidate_status: status, source_id: sourceId })
      .where(eq(sourceCandidates.source_candidate_id, sourceCandidateId));
  }

  /**
   * Proposed candidates whose card was not queued yet, the most matching positions first
   *
   * @param {number} limit
   *
   * @returns {Promise<SourceCandidateRowType[]>}
   */
  async findUnnotified(limit: number): Promise<SourceCandidateRowType[]> {
    return this.databaseService.db
      .select()
      .from(sourceCandidates)
      .where(
        and(
          eq(sourceCandidates.source_candidate_status, SourceCandidateStatusEnum.PROPOSED),
          isNull(sourceCandidates.source_candidate_notified_at)
        )
      )
      .orderBy(desc(sourceCandidates.source_candidate_matching), asc(sourceCandidates.source_candidate_id))
      .limit(limit);
  }

  /**
   * Candidates whose card was queued and that wait for the owner's decision
   *
   * @returns {Promise<number>}
   */
  async countOpenCards(): Promise<number> {
    const [row] = await this.databaseService.db
      .select({ open: count() })
      .from(sourceCandidates)
      .where(
        and(
          eq(sourceCandidates.source_candidate_status, SourceCandidateStatusEnum.PROPOSED),
          isNotNull(sourceCandidates.source_candidate_notified_at)
        )
      );

    return row?.open ?? 0;
  }

  /**
   * Note that the cards of the candidates were queued
   *
   * @param {readonly number[]} sourceCandidateIds
   *
   * @returns {Promise<void>}
   */
  async markNotified(sourceCandidateIds: readonly number[]): Promise<void> {
    if (sourceCandidateIds.length === 0) {
      return;
    }

    await this.databaseService.db
      .update(sourceCandidates)
      .set({ source_candidate_notified_at: sql`now()` })
      .where(inArray(sourceCandidates.source_candidate_id, [...sourceCandidateIds]));
  }

  /**
   * Every candidate
   *
   * @returns {Promise<SourceCandidateRowType[]>}
   */
  async findAll(): Promise<SourceCandidateRowType[]> {
    return this.databaseService.db.select().from(sourceCandidates).orderBy(asc(sourceCandidates.source_candidate_id));
  }

  /**
   * Store a checked board: a new candidate, or the next check of a known one — its counts, status and check time
   *
   * @param {SourceCandidateInsertType} values
   *
   * @throws {Error} `SOURCE_CANDIDATE_NOT_STORED` if the database returns no row
   *
   * @returns {Promise<SourceCandidateRowType>}
   */
  async upsert(values: SourceCandidateInsertType): Promise<SourceCandidateRowType> {
    const [row] = await this.databaseService.db
      .insert(sourceCandidates)
      .values(values)
      .onConflictDoUpdate({
        target: [sourceCandidates.source_candidate_ats_kind, sourceCandidates.source_candidate_board],
        set: {
          source_candidate_company: values.source_candidate_company,
          source_candidate_status: values.source_candidate_status,
          source_candidate_positions: values.source_candidate_positions,
          source_candidate_matching: values.source_candidate_matching,
          source_candidate_unknown: values.source_candidate_unknown ?? 0,
          source_candidate_examples: values.source_candidate_examples ?? [],
          source_candidate_checked_at: sql`now()`
        }
      })
      .returning();

    if (!row) {
      throw new Error(`SOURCE_CANDIDATE_NOT_STORED: ${values.source_candidate_ats_kind} ${values.source_candidate_board}`);
    }

    return row;
  }
}
