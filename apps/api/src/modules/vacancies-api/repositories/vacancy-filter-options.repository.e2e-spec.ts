import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { truncateTables } from '@job-agent/db';
import { VacancyStageEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { PIPELINE_TABLES, insertSource, insertVacancy } from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { VacancyFilterOptionsRepository } from './vacancy-filter-options.repository.js';

describe('VacancyFilterOptionsRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: VacancyFilterOptionsRepository;
  let database: DatabaseService;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [VacancyFilterOptionsRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(VacancyFilterOptionsRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, PIPELINE_TABLES);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('gives nothing without vacancies', async () => {
    await insertSource(database, { source_name: 'Northwind' });

    await expect(repository.findAll()).resolves.toEqual({ sources: [], countries: [], cities: [] });
  });

  it('offers the sources, countries and cities of the open vacancies only, each once and in order', async () => {
    const northwind = await insertSource(database, { source_name: 'Northwind' });
    const contoso = await insertSource(database, { source_name: 'Contoso', source_is_active: false });
    const fabrikam = await insertSource(database, { source_name: 'Fabrikam' });

    await insertVacancy(database, northwind.source_id, { vacancy_country: 'UA', vacancy_city: 'Kyiv' });
    await insertVacancy(database, northwind.source_id, { vacancy_country: 'IL', vacancy_city: 'Tel Aviv' });
    await insertVacancy(database, northwind.source_id, { vacancy_country: 'IL', vacancy_city: 'Tel Aviv' });
    await insertVacancy(database, contoso.source_id, { vacancy_country: 'IL', vacancy_city: 'Haifa' });
    await insertVacancy(database, contoso.source_id, { vacancy_city: 'Remote' });
    await insertVacancy(database, fabrikam.source_id, {
      vacancy_country: 'DE',
      vacancy_city: 'Berlin',
      vacancy_stage: VacancyStageEnum.CLOSED
    });

    await expect(repository.findAll()).resolves.toEqual({
      sources: [
        { sourceId: contoso.source_id, name: 'Contoso' },
        { sourceId: northwind.source_id, name: 'Northwind' }
      ],
      countries: ['IL', 'UA'],
      cities: [
        { country: 'IL', city: 'Haifa' },
        { country: 'IL', city: 'Tel Aviv' },
        { country: 'UA', city: 'Kyiv' },
        { country: null, city: 'Remote' }
      ]
    });
  });
});
