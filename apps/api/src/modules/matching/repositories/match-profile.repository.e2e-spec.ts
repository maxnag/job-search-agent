import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resumeSkills, truncateTables } from '@job-agent/db';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { PIPELINE_TABLES, insertProfileWithResume, insertResume } from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { MatchProfileRepository } from './match-profile.repository.js';

describe('MatchProfileRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: MatchProfileRepository;
  let database: DatabaseService;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [MatchProfileRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(MatchProfileRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, PIPELINE_TABLES);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('gives nothing without profiles', async () => {
    await expect(repository.findCurrent()).resolves.toEqual([]);
  });

  it('gives each profile with its current resume, years and visible skill keys', async () => {
    const developer = await insertProfileWithResume(database, 'developer', {
      skillKeys: ['typescript', 'php'],
      experienceYears: 12.5,
      preferences: { min_level: 'senior' }
    });

    await database.db.update(resumeSkills).set({ resume_skill_is_hidden: true }).where(eq(resumeSkills.resume_skill_key, 'php'));

    await expect(repository.findCurrent()).resolves.toEqual([
      {
        profileId: developer.profileId,
        profileName: 'developer',
        preferences: { min_level: 'senior' },
        resumeId: developer.resumeId,
        experienceYears: 12.5,
        skillKeys: ['typescript']
      }
    ]);
  });

  it('uses the current resume version only', async () => {
    const { profileId, resumeId: older } = await insertProfileWithResume(database, 'developer', { isCurrent: false, skillKeys: ['java'] });
    const current = await insertResume(database, profileId, { skillKeys: ['typescript'] });

    const [profile] = await repository.findCurrent();

    expect(profile?.resumeId).toBe(current);
    expect(profile?.resumeId).not.toBe(older);
    expect(profile?.skillKeys).toEqual(['typescript']);
  });

  it('leaves out a profile without a current resume', async () => {
    await insertProfileWithResume(database, 'developer', { isCurrent: false });

    await expect(repository.findCurrent()).resolves.toEqual([]);
  });

  it('gives one profile when asked, with no skills when the resume has none', async () => {
    await insertProfileWithResume(database, 'developer');

    const cook = await insertProfileWithResume(database, 'cook', { skillKeys: [], experienceYears: null });

    await expect(repository.findCurrent(cook.profileId)).resolves.toEqual([
      expect.objectContaining({ profileName: 'cook', experienceYears: null, skillKeys: [] })
    ]);
  });
});
