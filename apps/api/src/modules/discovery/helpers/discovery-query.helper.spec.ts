import { describe, expect, it } from 'vitest';

import { RoleFamilyEnum, WorkModeEnum } from '@job-agent/shared';

import type { IProfilePreferencesEntry } from '../../search/interfaces/profile-preferences-entry.interface.js';
import { buildDiscoveryQueries } from './discovery-query.helper.js';

/**
 * A profile with roles and places
 *
 * @param {RoleFamilyEnum[]} roleFamilies
 * @param {{ country: string; work_modes: WorkModeEnum[] }[]} places
 *
 * @returns {IProfilePreferencesEntry}
 */
function profile(roleFamilies: RoleFamilyEnum[], places: { country: string; work_modes: WorkModeEnum[] }[]): IProfilePreferencesEntry {
  return {
    name: 'developer',
    preferences: {
      role_families: roleFamilies,
      places: places.map(place => ({ ...place, excluded_cities: [] })),
      excluded_companies: []
    }
  };
}

describe('buildDiscoveryQueries', () => {
  it('asks each board site for each place and role', () => {
    const queries = buildDiscoveryQueries([profile([RoleFamilyEnum.BACKEND], [{ country: 'IL', work_modes: [WorkModeEnum.HYBRID] }])], 10);

    expect(queries).toEqual([
      'site:comeet.com/jobs Israel "backend"',
      'site:job-boards.greenhouse.io Israel "backend"',
      'site:jobs.lever.co Israel "backend"'
    ]);
  });

  it('adds "remote" for a country searched only for remote work', () => {
    const queries = buildDiscoveryQueries([profile([RoleFamilyEnum.QA], [{ country: 'UA', work_modes: [WorkModeEnum.REMOTE] }])], 1);

    expect(queries).toEqual(['site:comeet.com/jobs Ukraine remote "QA"']);
  });

  it('merges the work modes of one country across profiles', () => {
    const queries = buildDiscoveryQueries(
      [
        profile([RoleFamilyEnum.BACKEND], [{ country: 'UA', work_modes: [WorkModeEnum.REMOTE] }]),
        profile([RoleFamilyEnum.BACKEND], [{ country: 'UA', work_modes: [WorkModeEnum.HYBRID] }])
      ],
      10
    );

    expect(queries).toHaveLength(3);
    expect(queries.every(query => !query.includes('remote'))).toBe(true);
  });

  it('asks for each role once even when several profiles search it', () => {
    const queries = buildDiscoveryQueries(
      [
        profile([RoleFamilyEnum.BACKEND, RoleFamilyEnum.FULL_STACK], [{ country: 'IL', work_modes: [WorkModeEnum.ONSITE] }]),
        profile([RoleFamilyEnum.BACKEND], [])
      ],
      100
    );

    expect(queries).toHaveLength(6);
    expect(queries.filter(query => query.includes('"backend"'))).toHaveLength(3);
  });

  it('skips the role "other", which has no search words', () => {
    expect(buildDiscoveryQueries([profile([RoleFamilyEnum.OTHER], [{ country: 'IL', work_modes: [WorkModeEnum.HYBRID] }])], 10)).toEqual(
      []
    );
  });

  it('skips a country code with no English name', () => {
    expect(buildDiscoveryQueries([profile([RoleFamilyEnum.BACKEND], [{ country: 'QX', work_modes: [WorkModeEnum.HYBRID] }])], 10)).toEqual(
      []
    );
  });

  it('stops at the query limit, places first', () => {
    const queries = buildDiscoveryQueries(
      [
        profile(
          [RoleFamilyEnum.BACKEND, RoleFamilyEnum.FRONTEND],
          [
            { country: 'IL', work_modes: [WorkModeEnum.HYBRID] },
            { country: 'UA', work_modes: [WorkModeEnum.REMOTE] }
          ]
        )
      ],
      4
    );

    expect(queries).toEqual([
      'site:comeet.com/jobs Israel "backend"',
      'site:job-boards.greenhouse.io Israel "backend"',
      'site:jobs.lever.co Israel "backend"',
      'site:comeet.com/jobs Israel "frontend"'
    ]);
  });

  it('gives no queries without profiles', () => {
    expect(buildDiscoveryQueries([], 10)).toEqual([]);
  });
});
