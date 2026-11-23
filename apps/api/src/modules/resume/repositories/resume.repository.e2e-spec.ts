import { Test, type TestingModule } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { profiles, resumeLanguages, resumeSkills, resumes, truncateTables } from '@job-agent/db';
import { LanguageLevelEnum, SkillKindEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { DatabaseService } from '../../database/services/database.service.js';
import type { ICreateResumeRequest } from '../interfaces/create-resume.interface.js';
import type { IResumeSkill } from '../interfaces/extracted-resume.interface.js';
import { ProfileRepository } from './profile.repository.js';
import { ResumeRepository } from './resume.repository.js';

/**
 * A dictionary skill of the resume fixtures
 *
 * @param {string} key
 * @param {SkillKindEnum} kind
 *
 * @returns {IResumeSkill}
 */
function skill(key: string, kind: SkillKindEnum): IResumeSkill {
  return { key, name: key, kind, years: 3, isUnknown: false, isClaimed: true };
}

/**
 * A resume version request with the given file hash and skills
 *
 * @param {number} profileId
 * @param {string} fileHash
 * @param {readonly IResumeSkill[]} skills
 *
 * @returns {ICreateResumeRequest}
 */
function resumeRequest(profileId: number, fileHash: string, skills: readonly IResumeSkill[]): ICreateResumeRequest {
  return {
    profileId,
    fileName: 'resume.pdf',
    fileHash,
    filePath: `profiles/${profileId}/${fileHash}.pdf`,
    text: 'Fictional resume text',
    extracted: {
      data: { positions: [], claimed_skills: [], languages: [] },
      model: 'test-model',
      experienceYears: 7,
      skills,
      languages: [{ code: 'en', level: LanguageLevelEnum.FLUENT }]
    }
  };
}

const typescript = skill('typescript', SkillKindEnum.PROGRAMMING_LANGUAGE);
const php = skill('php', SkillKindEnum.PROGRAMMING_LANGUAGE);
const nestjs = skill('nestjs', SkillKindEnum.FRAMEWORK);

describe('ResumeRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: ResumeRepository;
  let databaseService: DatabaseService;
  let profileId: number;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [ResumeRepository, ProfileRepository, testDatabaseProvider()] }).compile();

    repository = moduleFixture.get(ResumeRepository);
    databaseService = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(databaseService.db, [profiles]);

    profileId = (await moduleFixture.get(ProfileRepository).findOrCreate('developer')).profile_id;
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  /**
   * Ids of the current versions of the profile
   *
   * @returns {Promise<number[]>}
   */
  async function currentIds(): Promise<number[]> {
    const rows = await databaseService.db
      .select({ id: resumes.resume_id })
      .from(resumes)
      .where(and(eq(resumes.profile_id, profileId), eq(resumes.resume_is_current, true)));

    return rows.map(row => row.id);
  }

  /**
   * Keys of the hidden skills of a version
   *
   * @param {number} resumeId
   *
   * @returns {Promise<string[]>}
   */
  async function hiddenKeys(resumeId: number): Promise<string[]> {
    const rows = await databaseService.db
      .select({ key: resumeSkills.resume_skill_key })
      .from(resumeSkills)
      .where(and(eq(resumeSkills.resume_id, resumeId), eq(resumeSkills.resume_skill_is_hidden, true)));

    return rows.map(row => row.key).sort((left, right) => left.localeCompare(right));
  }

  /**
   * The owner hides a skill of a version by hand
   *
   * @param {number} resumeId
   * @param {string} key
   *
   * @returns {Promise<void>}
   */
  async function hide(resumeId: number, key: string): Promise<void> {
    await databaseService.db
      .update(resumeSkills)
      .set({ resume_skill_is_hidden: true })
      .where(and(eq(resumeSkills.resume_id, resumeId), eq(resumeSkills.resume_skill_key, key)));
  }

  describe('findByHash', () => {
    it('finds nothing before the file is imported', async () => {
      await expect(repository.findByHash(profileId, 'hash-1')).resolves.toBeUndefined();
    });

    it('finds the version made from the same file of the same profile only', async () => {
      const { resumeId } = await repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript]));
      const otherProfileId = (await moduleFixture.get(ProfileRepository).findOrCreate('cook')).profile_id;

      await expect(repository.findByHash(profileId, 'hash-1')).resolves.toMatchObject({ resume_id: resumeId });
      await expect(repository.findByHash(otherProfileId, 'hash-1')).resolves.toBeUndefined();
    });
  });

  describe('createCurrent', () => {
    it('stores the first version as current with its skills and languages', async () => {
      const result = await repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript, nestjs]));
      const skills = await databaseService.db.select().from(resumeSkills).where(eq(resumeSkills.resume_id, result.resumeId));
      const languages = await databaseService.db.select().from(resumeLanguages).where(eq(resumeLanguages.resume_id, result.resumeId));

      expect(result.hiddenSkillKeys).toEqual([]);
      await expect(currentIds()).resolves.toEqual([result.resumeId]);
      expect(skills.map(row => row.resume_skill_key).sort((left, right) => left.localeCompare(right))).toEqual(['nestjs', 'typescript']);
      expect(skills.every(row => !row.resume_skill_is_hidden)).toBe(true);
      expect(languages).toMatchObject([{ resume_language_code: 'en', resume_language_level: LanguageLevelEnum.FLUENT }]);
    });

    it('stores a version without skills and languages', async () => {
      const request = resumeRequest(profileId, 'hash-1', []);
      const result = await repository.createCurrent({ ...request, extracted: { ...request.extracted, languages: [] } });

      await expect(currentIds()).resolves.toEqual([result.resumeId]);
    });

    it('makes the new version the only current one and carries over the skills the owner hid', async () => {
      const first = await repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript, php]));

      await hide(first.resumeId, 'php');

      const second = await repository.createCurrent(resumeRequest(profileId, 'hash-2', [typescript, php, nestjs]));

      expect(second.hiddenSkillKeys).toEqual(['php']);
      await expect(currentIds()).resolves.toEqual([second.resumeId]);
      await expect(hiddenKeys(second.resumeId)).resolves.toEqual(['php']);
    });

    it('reports no carried skill the new version does not have', async () => {
      const first = await repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript, php]));

      await hide(first.resumeId, 'php');

      const second = await repository.createCurrent(resumeRequest(profileId, 'hash-2', [typescript]));

      expect(second.hiddenSkillKeys).toEqual([]);
      await expect(hiddenKeys(second.resumeId)).resolves.toEqual([]);
    });

    it('rolls back on a duplicate file: the previous version stays current', async () => {
      const first = await repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript]));

      await expect(repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript]))).rejects.toThrow();
      await expect(currentIds()).resolves.toEqual([first.resumeId]);
    });
  });

  describe('setCurrent', () => {
    it('makes an older version current again with the hidden set of the version that was current', async () => {
      const first = await repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript, php, nestjs]));

      await hide(first.resumeId, 'nestjs');

      const second = await repository.createCurrent(resumeRequest(profileId, 'hash-2', [typescript, php, nestjs]));

      await hide(second.resumeId, 'php');

      const result = await repository.setCurrent(profileId, first.resumeId);

      expect(result).toEqual({ resumeId: first.resumeId, hiddenSkillKeys: expect.arrayContaining(['nestjs', 'php']) as string[] });
      await expect(currentIds()).resolves.toEqual([first.resumeId]);
      await expect(hiddenKeys(first.resumeId)).resolves.toEqual(['nestjs', 'php']);
    });

    it('unhides every skill when the version that was current hides none', async () => {
      const first = await repository.createCurrent(resumeRequest(profileId, 'hash-1', [typescript, php]));

      await hide(first.resumeId, 'php');

      const second = await repository.createCurrent(resumeRequest(profileId, 'hash-2', [typescript]));
      const result = await repository.setCurrent(profileId, first.resumeId);

      expect(second.hiddenSkillKeys).toEqual([]);
      expect(result.hiddenSkillKeys).toEqual([]);
      await expect(hiddenKeys(first.resumeId)).resolves.toEqual([]);
    });
  });
});
