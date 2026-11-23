import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RoleFamilyEnum } from '@job-agent/shared';

import type { ProfileRowType } from '../../resume/interfaces/profile-row.interface.js';
import { ProfileRepository } from '../../resume/repositories/profile.repository.js';
import { ProfilePreferencesService } from './profile-preferences.service.js';

describe('ProfilePreferencesService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ProfilePreferencesService;
  let profiles: DeepMocked<ProfileRepository>;

  beforeEach(async () => {
    profiles = createMock<ProfileRepository>();
    moduleFixture = await Test.createTestingModule({
      providers: [ProfilePreferencesService, { provide: ProfileRepository, useValue: profiles }]
    }).compile();

    subjectUnderTest = moduleFixture.get(ProfilePreferencesService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('reads the preferences of every profile by name', async () => {
    profiles.findAll.mockResolvedValue([
      { profile_name: 'developer', profile_preferences: { role_families: [RoleFamilyEnum.BACKEND] } },
      { profile_name: 'cook', profile_preferences: {} }
    ] as ProfileRowType[]);

    await expect(subjectUnderTest.findAll()).resolves.toEqual([
      { name: 'developer', preferences: { role_families: [RoleFamilyEnum.BACKEND], places: [], excluded_companies: [] } },
      { name: 'cook', preferences: { role_families: [], places: [], excluded_companies: [] } }
    ]);
  });

  it('gives nothing without profiles', async () => {
    profiles.findAll.mockResolvedValue([]);

    await expect(subjectUnderTest.findAll()).resolves.toEqual([]);
  });

  it('refuses invalid preferences, naming the profile', async () => {
    profiles.findAll.mockResolvedValue([
      { profile_name: 'developer', profile_preferences: { min_level: 'guru' } }
    ] as unknown as ProfileRowType[]);

    await expect(subjectUnderTest.findAll()).rejects.toThrow('PROFILE_PREFERENCES_INVALID: profile developer: min_level');
  });
});
