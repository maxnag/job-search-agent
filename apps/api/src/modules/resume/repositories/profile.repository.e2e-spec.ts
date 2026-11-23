import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { profiles, truncateTables } from '@job-agent/db';
import { SkillKindEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { ProfileRepository } from './profile.repository.js';

describe('ProfileRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: ProfileRepository;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [ProfileRepository, testDatabaseProvider()] }).compile();

    repository = moduleFixture.get(ProfileRepository);
    databaseService = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(databaseService.db, [profiles]);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('finds nothing for an unknown name', async () => {
    await expect(repository.findOne('developer')).resolves.toBeUndefined();
  });

  it('creates a profile with the default core skill kinds and empty preferences', async () => {
    const profile = await repository.findOrCreate('developer');

    expect(profile.profile_name).toBe('developer');
    expect(profile.profile_core_skill_kinds).toEqual([SkillKindEnum.PROGRAMMING_LANGUAGE]);
    expect(profile.profile_preferences).toEqual({});
    await expect(repository.findOne('developer')).resolves.toEqual(profile);
  });

  it('returns the existing profile on a second call instead of a duplicate', async () => {
    const first = await repository.findOrCreate('developer');
    const second = await repository.findOrCreate('developer');
    const rows = await databaseService.db.select().from(profiles);

    expect(second.profile_id).toBe(first.profile_id);
    expect(rows).toHaveLength(1);
  });

  it('keeps profiles apart by name', async () => {
    const developer = await repository.findOrCreate('developer');
    const cook = await repository.findOrCreate('cook');

    expect(cook.profile_id).not.toBe(developer.profile_id);
  });
});
