import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { sources } from '@job-agent/db';
import { SourceStatusEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { SourceInsertType, SourceRowType } from '../interfaces/source-row.interface.js';

/**
 * Data access of the career pages
 */
@Injectable()
export class SourceRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Source by its id
   *
   * @param {number} sourceId
   *
   * @returns {Promise<SourceRowType | undefined>}
   */
  async findOne(sourceId: number): Promise<SourceRowType | undefined> {
    const [row] = await this.databaseService.db.select().from(sources).where(eq(sources.source_id, sourceId)).limit(1);

    return row;
  }

  /**
   * Source by its URL
   *
   * @param {string} url
   *
   * @returns {Promise<SourceRowType | undefined>}
   */
  async findByURL(url: string): Promise<SourceRowType | undefined> {
    const [row] = await this.databaseService.db.select().from(sources).where(eq(sources.source_url, url)).limit(1);

    return row;
  }

  /**
   * Add a source; `undefined` when a source with the URL already exists
   *
   * @param {SourceInsertType} values
   *
   * @returns {Promise<SourceRowType | undefined>}
   */
  async create(values: SourceInsertType): Promise<SourceRowType | undefined> {
    const [row] = await this.databaseService.db.insert(sources).values(values).onConflictDoNothing().returning();

    return row;
  }

  /**
   * Sources the schedule scans: switched on by the owner and not stopped by the crawler
   *
   * @returns {Promise<SourceRowType[]>}
   */
  async findScannable(): Promise<SourceRowType[]> {
    return this.databaseService.db
      .select()
      .from(sources)
      .where(and(eq(sources.source_is_active, true), eq(sources.source_status, SourceStatusEnum.OK)))
      .orderBy(asc(sources.source_id));
  }

  /**
   * Sources the owner switched on, whatever the crawler noted — a forced scan
   *
   * @returns {Promise<SourceRowType[]>}
   */
  async findActive(): Promise<SourceRowType[]> {
    return this.databaseService.db.select().from(sources).where(eq(sources.source_is_active, true)).orderBy(asc(sources.source_id));
  }

  /**
   * Every source
   *
   * @returns {Promise<SourceRowType[]>}
   */
  async findAll(): Promise<SourceRowType[]> {
    return this.databaseService.db.select().from(sources).orderBy(asc(sources.source_id));
  }

  /**
   * A scan finished: the source is fine again
   *
   * @param {number} sourceId
   *
   * @returns {Promise<void>}
   */
  async markScanned(sourceId: number): Promise<void> {
    await this.databaseService.db
      .update(sources)
      .set({ source_status: SourceStatusEnum.OK, source_last_scan_at: sql`now()`, source_last_error: null })
      .where(eq(sources.source_id, sourceId));
  }

  /**
   * A scan failed; a status is given when the crawler stops the source until the owner resets it
   *
   * @param {number} sourceId
   * @param {string} error
   * @param {SourceStatusEnum} [status]
   *
   * @returns {Promise<void>}
   */
  async markFailed(sourceId: number, error: string, status?: SourceStatusEnum): Promise<void> {
    await this.databaseService.db
      .update(sources)
      .set({ source_last_scan_at: sql`now()`, source_last_error: error, ...(status ? { source_status: status } : {}) })
      .where(eq(sources.source_id, sourceId));
  }
}
