import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull, ne, sql } from 'drizzle-orm';

import { sources, vacancies } from '@job-agent/db';
import { type IVacancyFilterOptions, VacancyStageEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';

/**
 * Reads the values the filters of the list of vacancies offer
 */
@Injectable()
export class VacancyFilterOptionsRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * The sources, countries and cities the open vacancies have — a source switched off since stays while its vacancies
   * are open; a city comes with its country
   *
   * @returns {Promise<IVacancyFilterOptions>}
   */
  async findAll(): Promise<IVacancyFilterOptions> {
    const { db } = this.databaseService;
    const open = ne(vacancies.vacancy_stage, VacancyStageEnum.CLOSED);
    const [sourceRows, countryRows, cityRows] = await Promise.all([
      db
        .selectDistinct({ sourceId: sources.source_id, name: sources.source_name })
        .from(sources)
        .innerJoin(vacancies, and(eq(vacancies.source_id, sources.source_id), open))
        .orderBy(asc(sources.source_name), asc(sources.source_id)),
      db
        .selectDistinct({ country: vacancies.vacancy_country })
        .from(vacancies)
        .where(and(open, isNotNull(vacancies.vacancy_country)))
        .orderBy(asc(vacancies.vacancy_country)),
      db
        .selectDistinct({ country: vacancies.vacancy_country, city: vacancies.vacancy_city })
        .from(vacancies)
        .where(and(open, isNotNull(vacancies.vacancy_city)))
        .orderBy(sql`${vacancies.vacancy_country} asc nulls last`, asc(vacancies.vacancy_city))
    ]);

    return {
      sources: sourceRows,
      countries: countryRows.flatMap(row => (row.country ? [row.country] : [])),
      cities: cityRows.flatMap(row => (row.city ? [{ country: row.country, city: row.city }] : []))
    };
  }
}
