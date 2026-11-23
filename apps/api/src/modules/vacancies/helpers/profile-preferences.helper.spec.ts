import { describe, expect, it } from 'vitest';

import { RoleFamilyEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

import { parseProfilePreferences } from './profile-preferences.helper.js';

describe('parseProfilePreferences', () => {
  it('fills the defaults of an empty object — nothing narrowed', () => {
    expect(parseProfilePreferences('developer', {})).toEqual({ role_families: [], places: [], excluded_companies: [] });
  });

  it('reads every field and upper-cases a country code', () => {
    expect(
      parseProfilePreferences('developer', {
        role_families: [RoleFamilyEnum.BACKEND],
        min_level: SeniorityLevelEnum.SENIOR,
        places: [{ country: 'il', work_modes: [WorkModeEnum.HYBRID], excluded_cities: ['Eilat'] }],
        excluded_companies: ['Northwind']
      })
    ).toEqual({
      role_families: [RoleFamilyEnum.BACKEND],
      min_level: SeniorityLevelEnum.SENIOR,
      places: [{ country: 'IL', work_modes: [WorkModeEnum.HYBRID], excluded_cities: ['Eilat'] }],
      excluded_companies: ['Northwind']
    });
  });

  it('names the profile and every invalid field', () => {
    expect(() =>
      parseProfilePreferences('developer', {
        role_families: ['astronaut'],
        places: [{ country: 'ISR', work_modes: [] }]
      })
    ).toThrow('PROFILE_PREFERENCES_INVALID: profile developer: role_families.0, places.0.country, places.0.work_modes');
  });

  it.each([null, 'remote', 42])('refuses %j, which is not an object', value => {
    expect(() => parseProfilePreferences('developer', value)).toThrow(/^PROFILE_PREFERENCES_INVALID: profile developer/);
  });
});
