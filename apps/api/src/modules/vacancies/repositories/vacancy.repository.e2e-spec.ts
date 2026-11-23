import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { truncateTables } from '@job-agent/db';
import { VacancyStageEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import {
  PIPELINE_TABLES,
  insertAction,
  insertMatch,
  insertProfileWithResume,
  insertSource,
  insertVacancy
} from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { VacancyRepository } from './vacancy.repository.js';

describe('VacancyRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: VacancyRepository;
  let database: DatabaseService;
  let sourceId: number;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [VacancyRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(VacancyRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, PIPELINE_TABLES);
    sourceId = (await insertSource(database)).source_id;
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('finds, updates and closes a vacancy', async () => {
    const vacancy = await insertVacancy(database, sourceId);

    await repository.update(vacancy.vacancy_id, { vacancy_city: 'Haifa' });
    await expect(repository.findOne(vacancy.vacancy_id)).resolves.toMatchObject({ vacancy_city: 'Haifa' });

    await repository.close(vacancy.vacancy_id);

    const closed = await repository.findOne(vacancy.vacancy_id);

    expect(closed?.vacancy_stage).toBe(VacancyStageEnum.CLOSED);
    expect(closed?.vacancy_closed_at).toBeInstanceOf(Date);
    await expect(repository.findOne(999)).resolves.toBeUndefined();
  });

  it('finds known vacancies by URL or by dedup key', async () => {
    const byURL = await insertVacancy(database, sourceId);
    const byKey = await insertVacancy(database, sourceId);

    await insertVacancy(database, sourceId);

    const known = await repository.findKnown([byURL.vacancy_url], [byKey.vacancy_dedup_key]);

    expect(known.map(row => row.vacancy_id).toSorted((a, b) => a - b)).toEqual([byURL.vacancy_id, byKey.vacancy_id]);
    await expect(repository.findKnown([], [])).resolves.toEqual([]);
  });

  it('lists the open vacancies of a source only', async () => {
    const open = await insertVacancy(database, sourceId);
    const other = (await insertSource(database)).source_id;

    await insertVacancy(database, sourceId, { vacancy_stage: VacancyStageEnum.CLOSED });
    await insertVacancy(database, other);

    expect((await repository.findOpenBySource(sourceId)).map(row => row.vacancy_id)).toEqual([open.vacancy_id]);
  });

  describe('applyScan', () => {
    it('inserts, updates and closes in one go, returning what it wrote', async () => {
      const known = await insertVacancy(database, sourceId);
      const gone = await insertVacancy(database, sourceId);
      const result = await repository.applyScan({
        inserts: [
          {
            source_id: sourceId,
            vacancy_url: 'https://careers.example.com/jobs/new',
            vacancy_title: 'QA Engineer',
            vacancy_company: 'Northwind',
            vacancy_dedup_key: 'northwind|qa engineer',
            vacancy_stage: VacancyStageEnum.SKIPPED
          }
        ],
        updates: [
          { vacancyId: known.vacancy_id, values: { vacancy_city: 'Haifa' } },
          { vacancyId: 999, values: { vacancy_city: 'x' } }
        ],
        closeIds: [gone.vacancy_id],
        recheckIds: []
      });

      expect(result.created).toEqual([{ vacancyId: expect.any(Number) as number, stage: VacancyStageEnum.SKIPPED }]);
      expect(result.updated).toEqual([{ vacancyId: known.vacancy_id, stage: VacancyStageEnum.LISTED }]);
      expect(result.closedIds).toEqual([gone.vacancy_id]);
      await expect(repository.findOne(gone.vacancy_id)).resolves.toMatchObject({ vacancy_stage: VacancyStageEnum.CLOSED });
    });

    it('skips an insert that collides with a stored URL instead of failing the scan', async () => {
      const known = await insertVacancy(database, sourceId);
      const result = await repository.applyScan({
        inserts: [
          {
            source_id: sourceId,
            vacancy_url: known.vacancy_url,
            vacancy_title: 'Backend Developer',
            vacancy_company: 'Northwind',
            vacancy_dedup_key: 'another key'
          }
        ],
        updates: [],
        closeIds: [],
        recheckIds: []
      });

      expect(result.created).toEqual([]);
    });

    it('writes nothing for an empty plan', async () => {
      await expect(repository.applyScan({ inserts: [], updates: [], closeIds: [], recheckIds: [] })).resolves.toEqual({
        created: [],
        updated: [],
        closedIds: []
      });
    });

    it('rolls the whole scan back when one write fails', async () => {
      const known = await insertVacancy(database, sourceId);

      await expect(
        repository.applyScan({
          inserts: [],
          updates: [{ vacancyId: known.vacancy_id, values: { vacancy_city: 'Haifa', vacancy_title: null as unknown as string } }],
          closeIds: [known.vacancy_id],
          recheckIds: []
        })
      ).rejects.toThrow();
      await expect(repository.findOne(known.vacancy_id)).resolves.toMatchObject({
        vacancy_city: null,
        vacancy_stage: VacancyStageEnum.LISTED
      });
    });
  });

  it('names the vacancies the owner heard about: a card sent or a button pressed', async () => {
    const { resumeId } = await insertProfileWithResume(database, 'developer');
    const carded = await insertVacancy(database, sourceId);
    const pressed = await insertVacancy(database, sourceId);
    const matchedOnly = await insertVacancy(database, sourceId);
    const unknown = await insertVacancy(database, sourceId);

    await insertMatch(database, carded.vacancy_id, resumeId, { vacancy_match_notified_at: new Date() });
    await insertMatch(database, matchedOnly.vacancy_id, resumeId);
    await insertAction(database, pressed.vacancy_id);

    const ids = await repository.findNotifiedIds([carded.vacancy_id, pressed.vacancy_id, matchedOnly.vacancy_id, unknown.vacancy_id]);

    expect(ids.toSorted((a, b) => a - b)).toEqual([carded.vacancy_id, pressed.vacancy_id]);
    await expect(repository.findNotifiedIds([])).resolves.toEqual([]);
  });
});
