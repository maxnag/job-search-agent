import { Test, type TestingModule } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sourceCandidates, sources, truncateTables } from '@job-agent/db';
import { ATSKindEnum, SourceCandidateStatusEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { insertSource } from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import type { SourceCandidateInsertType } from '../interfaces/source-candidate-row.interface.js';
import { SourceCandidateRepository } from './source-candidate.repository.js';

/**
 * Values of a found board
 *
 * @param {string} board
 * @param {Partial<SourceCandidateInsertType>} changes
 *
 * @returns {SourceCandidateInsertType}
 */
function found(board: string, changes: Partial<SourceCandidateInsertType> = {}): SourceCandidateInsertType {
  return {
    source_candidate_ats_kind: ATSKindEnum.GREENHOUSE,
    source_candidate_board: board,
    source_candidate_company: 'Northwind',
    source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
    source_candidate_positions: 10,
    source_candidate_matching: 2,
    source_candidate_unknown: 1,
    source_candidate_examples: ['Backend Engineer — Haifa'],
    ...changes
  };
}

describe('SourceCandidateRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: SourceCandidateRepository;
  let database: DatabaseService;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [SourceCandidateRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(SourceCandidateRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, [sourceCandidates, sources]);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  describe('upsert', () => {
    it('stores a new board with its counts and examples', async () => {
      const row = await repository.upsert(found('northwind'));

      expect(row).toMatchObject({
        source_candidate_ats_kind: ATSKindEnum.GREENHOUSE,
        source_candidate_board: 'northwind',
        source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
        source_candidate_positions: 10,
        source_candidate_matching: 2,
        source_candidate_unknown: 1,
        source_candidate_examples: ['Backend Engineer — Haifa'],
        source_candidate_notified_at: null,
        source_id: null
      });
      expect(row.source_candidate_checked_at).toBeInstanceOf(Date);
    });

    it('updates the same board of the same system in place, keeping its id and its card', async () => {
      const first = await repository.upsert(found('northwind', { source_candidate_status: SourceCandidateStatusEnum.EMPTY }));

      await repository.markNotified([first.source_candidate_id]);
      await database.db
        .update(sourceCandidates)
        .set({ source_candidate_checked_at: sql`now() - interval '40 days'` })
        .where(eq(sourceCandidates.source_candidate_id, first.source_candidate_id));

      const second = await repository.upsert(
        found('northwind', { source_candidate_company: 'Northwind Labs', source_candidate_matching: 5, source_candidate_examples: [] })
      );

      expect(second.source_candidate_id).toBe(first.source_candidate_id);
      expect(second).toMatchObject({
        source_candidate_company: 'Northwind Labs',
        source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
        source_candidate_matching: 5,
        source_candidate_examples: []
      });
      expect(second.source_candidate_notified_at).toBeInstanceOf(Date);
      expect(second.source_candidate_checked_at.getTime()).toBeGreaterThan(Date.now() - 60_000);
      expect(await repository.findAll()).toHaveLength(1);
    });

    it('keeps the boards of one name on different systems apart', async () => {
      await repository.upsert(found('northwind'));
      await repository.upsert(found('northwind', { source_candidate_ats_kind: ATSKindEnum.LEVER }));

      expect(await repository.findAll()).toHaveLength(2);
    });

    it('defaults the unknown count and the examples on an update that leaves them out', async () => {
      await repository.upsert(found('northwind'));

      const { source_candidate_unknown: _unknown, source_candidate_examples: _examples, ...values } = found('northwind');
      const row = await repository.upsert(values);

      expect(row.source_candidate_unknown).toBe(0);
      expect(row.source_candidate_examples).toEqual([]);
    });
  });

  describe('findOne and findAll', () => {
    it('finds a candidate by id, and nothing for an unknown one', async () => {
      const row = await repository.upsert(found('northwind'));

      await expect(repository.findOne(row.source_candidate_id)).resolves.toMatchObject({ source_candidate_board: 'northwind' });
      await expect(repository.findOne(999)).resolves.toBeUndefined();
    });

    it('lists every candidate in the order they were found', async () => {
      await repository.upsert(found('northwind'));
      await repository.upsert(found('contoso'));

      expect((await repository.findAll()).map(row => row.source_candidate_board)).toEqual(['northwind', 'contoso']);
    });
  });

  describe('markDecided', () => {
    it('stores the decision and links the added source', async () => {
      const row = await repository.upsert(found('northwind'));
      const source = await insertSource(database);

      await repository.markDecided(row.source_candidate_id, SourceCandidateStatusEnum.ADDED, source.source_id);

      await expect(repository.findOne(row.source_candidate_id)).resolves.toMatchObject({
        source_candidate_status: SourceCandidateStatusEnum.ADDED,
        source_id: source.source_id
      });
    });

    it('keeps the candidate when its source is deleted', async () => {
      const row = await repository.upsert(found('northwind'));
      const source = await insertSource(database);

      await repository.markDecided(row.source_candidate_id, SourceCandidateStatusEnum.ADDED, source.source_id);
      await database.db.delete(sources).where(eq(sources.source_id, source.source_id));

      await expect(repository.findOne(row.source_candidate_id)).resolves.toMatchObject({
        source_candidate_status: SourceCandidateStatusEnum.ADDED,
        source_id: null
      });
    });
  });

  describe('cards', () => {
    it('offers the unnotified proposed candidates, most matching first, then by id, up to the limit', async () => {
      const few = await repository.upsert(found('few', { source_candidate_matching: 1 }));
      const many = await repository.upsert(found('many', { source_candidate_matching: 9 }));
      const alsoFew = await repository.upsert(found('also-few', { source_candidate_matching: 1 }));

      await repository.upsert(found('empty', { source_candidate_status: SourceCandidateStatusEnum.EMPTY, source_candidate_matching: 0 }));
      await repository.upsert(
        found('ignored', { source_candidate_status: SourceCandidateStatusEnum.IGNORED, source_candidate_matching: 20 })
      );

      const told = await repository.upsert(found('told', { source_candidate_matching: 30 }));

      await repository.markNotified([told.source_candidate_id]);

      expect((await repository.findUnnotified(10)).map(row => row.source_candidate_id)).toEqual([
        many.source_candidate_id,
        few.source_candidate_id,
        alsoFew.source_candidate_id
      ]);
      expect(await repository.findUnnotified(1)).toHaveLength(1);
    });

    it('counts as open only the cards sent for candidates still undecided', async () => {
      const open = await repository.upsert(found('open'));
      const decided = await repository.upsert(found('decided'));

      await repository.upsert(found('unsent'));
      await repository.markNotified([open.source_candidate_id, decided.source_candidate_id]);
      await repository.markDecided(decided.source_candidate_id, SourceCandidateStatusEnum.IGNORED, null);

      await expect(repository.countOpenCards()).resolves.toBe(1);
    });

    it('counts no open card when none was sent', async () => {
      await repository.upsert(found('northwind'));

      await expect(repository.countOpenCards()).resolves.toBe(0);
    });

    it('marks nothing for no candidates', async () => {
      const row = await repository.upsert(found('northwind'));

      await repository.markNotified([]);

      await expect(repository.findOne(row.source_candidate_id)).resolves.toMatchObject({ source_candidate_notified_at: null });
    });
  });
});
