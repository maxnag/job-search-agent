import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { vacancies } from '@job-agent/db';

/**
 * A row of `vacancies`
 */
export type VacancyRowType = InferSelectModel<typeof vacancies>;

/**
 * Values of a new row of `vacancies`
 */
export type VacancyInsertType = InferInsertModel<typeof vacancies>;

/**
 * Columns of `vacancies` a scan may change
 */
export type VacancyUpdateType = Partial<Omit<VacancyInsertType, 'vacancy_id' | 'source_id' | 'dt_create' | 'dt_update'>>;
