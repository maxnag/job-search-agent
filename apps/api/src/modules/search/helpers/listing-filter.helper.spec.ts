import { describe, expect, it } from 'vitest';

import { RoleFamilyEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

import type { IListedPosition } from '../interfaces/listed-position.interface.js';
import type { IProfilePreferencesEntry } from '../interfaces/profile-preferences-entry.interface.js';
import { listingSkipReason } from './listing-filter.helper.js';

const POSITION: IListedPosition = {
  url: 'https://careers.example.com/jobs/1',
  title: 'QA Engineer',
  company: 'Northwind',
  country: 'IL',
  city: 'Haifa',
  workMode: WorkModeEnum.HYBRID,
  roleFamily: RoleFamilyEnum.QA,
  level: SeniorityLevelEnum.SENIOR
};

const DEVELOPER: IProfilePreferencesEntry = {
  name: 'developer',
  preferences: { role_families: [RoleFamilyEnum.BACKEND], places: [], excluded_companies: [] }
};

const TESTER: IProfilePreferencesEntry = {
  name: 'tester',
  preferences: { role_families: [RoleFamilyEnum.QA], places: [], excluded_companies: [] }
};

const JUNIOR_TESTER: IProfilePreferencesEntry = {
  name: 'junior-tester',
  preferences: { role_families: [RoleFamilyEnum.QA], min_level: SeniorityLevelEnum.PRINCIPAL, places: [], excluded_companies: [] }
};

describe('listingSkipReason', () => {
  it('drops every position when there is no profile to search for', () => {
    expect(listingSkipReason(POSITION, [])).toBe('no profile to search for');
  });

  it('gives the first finding of the only profile, without its name', () => {
    expect(listingSkipReason(POSITION, [DEVELOPER])).toBe('role qa is not searched');
  });

  it('keeps a position the only profile keeps', () => {
    expect(listingSkipReason(POSITION, [TESTER])).toBeUndefined();
  });

  it('keeps a position when any profile keeps it', () => {
    expect(listingSkipReason(POSITION, [DEVELOPER, TESTER])).toBeUndefined();
  });

  it('names each profile and its finding when every profile drops the position', () => {
    expect(listingSkipReason(POSITION, [DEVELOPER, JUNIOR_TESTER])).toBe(
      'developer: role qa is not searched; junior-tester: level senior is below principal'
    );
  });
});
