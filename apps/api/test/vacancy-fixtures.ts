import { randomUUID } from 'node:crypto';

import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { profiles, resumeSkills, resumes, sources, vacancies, vacancyActions, vacancyMatches } from '@job-agent/db';
import {
  SkillKindEnum,
  SourceFetchModeEnum,
  SourceStatusEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancyStageEnum
} from '@job-agent/shared';

import type { DatabaseService } from '../src/modules/database/services/database.service.js';

/**
 * How a fixture resume version looks
 */
interface IResumeFixtureOptions {
  /**
   * Current version of its profile, true by default
   *
   * @var {boolean}
   */
  readonly isCurrent?: boolean;

  /**
   * Keys of its skills, TypeScript by default
   *
   * @var {string[]}
   */
  readonly skillKeys?: string[];

  /**
   * Years of experience, ten by default
   *
   * @var {number | null}
   */
  readonly experienceYears?: number | null;
}

/**
 * How a fixture profile looks
 */
interface IProfileFixtureOptions extends IResumeFixtureOptions {
  /**
   * Preferences of the profile, none by default
   *
   * @var {Record<string, unknown>}
   */
  readonly preferences?: Record<string, unknown>;
}

/**
 * Every table the vacancy pipeline writes, for `truncateTables`
 *
 * @type {readonly [typeof sources, typeof profiles]}
 */
export const PIPELINE_TABLES = [sources, profiles] as const;

/**
 * Insert a source
 *
 * @param {DatabaseService} database
 * @param {Partial<InferInsertModel<typeof sources>>} [values]
 *
 * @returns {Promise<InferSelectModel<typeof sources>>}
 */
export async function insertSource(
  database: DatabaseService,
  values: Partial<InferInsertModel<typeof sources>> = {}
): Promise<InferSelectModel<typeof sources>> {
  const [row] = await database.db
    .insert(sources)
    .values({
      source_name: 'Northwind',
      source_url: `https://careers.example.com/${randomUUID()}`,
      source_fetch_mode: SourceFetchModeEnum.HTML,
      source_status: SourceStatusEnum.OK,
      ...values
    })
    .returning();

  return row as InferSelectModel<typeof sources>;
}

/**
 * Insert a vacancy of a source
 *
 * @param {DatabaseService} database
 * @param {number} sourceId
 * @param {Partial<InferInsertModel<typeof vacancies>>} [values]
 *
 * @returns {Promise<InferSelectModel<typeof vacancies>>}
 */
export async function insertVacancy(
  database: DatabaseService,
  sourceId: number,
  values: Partial<InferInsertModel<typeof vacancies>> = {}
): Promise<InferSelectModel<typeof vacancies>> {
  const suffix = randomUUID();
  const [row] = await database.db
    .insert(vacancies)
    .values({
      source_id: sourceId,
      vacancy_url: `https://careers.example.com/jobs/${suffix}`,
      vacancy_title: 'Backend Developer',
      vacancy_company: 'Northwind',
      vacancy_dedup_key: `northwind|backend developer ${suffix}`,
      vacancy_stage: VacancyStageEnum.LISTED,
      ...values
    })
    .returning();

  return row as InferSelectModel<typeof vacancies>;
}

/**
 * Insert a profile with one resume version and its skills
 *
 * @param {DatabaseService} database
 * @param {string} name
 * @param {IProfileFixtureOptions} [options]
 *
 * @returns {Promise<{ profileId: number; resumeId: number }>}
 */
export async function insertProfileWithResume(
  database: DatabaseService,
  name: string,
  options: IProfileFixtureOptions = {}
): Promise<{ profileId: number; resumeId: number }> {
  const [profile] = await database.db
    .insert(profiles)
    .values({ profile_name: name, profile_preferences: options.preferences ?? {} })
    .onConflictDoNothing()
    .returning();
  const profileId =
    profile?.profile_id ?? (await database.db.select().from(profiles)).find(row => row.profile_name === name)?.profile_id ?? 0;

  return { profileId, resumeId: await insertResume(database, profileId, options) };
}

/**
 * Insert a resume version of a profile with its skills
 *
 * @param {DatabaseService} database
 * @param {number} profileId
 * @param {IResumeFixtureOptions} [options]
 *
 * @returns {Promise<number>}
 */
export async function insertResume(database: DatabaseService, profileId: number, options: IResumeFixtureOptions = {}): Promise<number> {
  const [resume] = await database.db
    .insert(resumes)
    .values({
      profile_id: profileId,
      resume_file_name: 'cv.pdf',
      resume_file_hash: randomUUID(),
      resume_file_path: 'profiles/cv.pdf',
      resume_text: 'fictional resume',
      resume_data: {},
      resume_experience_years: options.experienceYears === undefined ? 10 : options.experienceYears,
      resume_llm_model: 'test',
      resume_is_current: options.isCurrent ?? true
    })
    .returning();
  const resumeId = resume?.resume_id ?? 0;
  const skillKeys = options.skillKeys ?? ['typescript'];

  if (skillKeys.length > 0) {
    await database.db.insert(resumeSkills).values(
      skillKeys.map(key => ({
        resume_id: resumeId,
        resume_skill_key: key,
        resume_skill_name: key,
        resume_skill_kind: SkillKindEnum.PROGRAMMING_LANGUAGE
      }))
    );
  }

  return resumeId;
}

/**
 * Insert a verdict of a vacancy against a resume version
 *
 * @param {DatabaseService} database
 * @param {number} vacancyId
 * @param {number} resumeId
 * @param {Partial<InferInsertModel<typeof vacancyMatches>>} [values]
 *
 * @returns {Promise<number>}
 */
export async function insertMatch(
  database: DatabaseService,
  vacancyId: number,
  resumeId: number,
  values: Partial<InferInsertModel<typeof vacancyMatches>> = {}
): Promise<number> {
  const [row] = await database.db
    .insert(vacancyMatches)
    .values({
      vacancy_id: vacancyId,
      resume_id: resumeId,
      vacancy_match_verdict: VacancyMatchVerdictEnum.FIT,
      vacancy_match_reasons: [],
      ...values
    })
    .returning();

  return row?.vacancy_match_id ?? 0;
}

/**
 * Insert a press of a button under a vacancy card
 *
 * @param {DatabaseService} database
 * @param {number} vacancyId
 * @param {VacancyActionKindEnum} [kind]
 *
 * @returns {Promise<void>}
 */
export async function insertAction(
  database: DatabaseService,
  vacancyId: number,
  kind: VacancyActionKindEnum = VacancyActionKindEnum.INTERESTED
): Promise<void> {
  await database.db.insert(vacancyActions).values({ vacancy_id: vacancyId, vacancy_action_kind: kind, vacancy_action_message_id: 555 });
}
