import { describe, expect, it } from 'vitest';

import { RoleFamilyEnum, WorkModeEnum } from '@job-agent/shared';

import type { IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';
import type { IProfilePreferencesEntry } from '../../search/interfaces/profile-preferences-entry.interface.js';
import { positionPlaces } from './position-place.helper.js';

/**
 * A profile searching places
 *
 * @param {{ country: string; work_modes: WorkModeEnum[] }[]} places
 *
 * @returns {IProfilePreferencesEntry}
 */
function profile(places: { country: string; work_modes: WorkModeEnum[] }[]): IProfilePreferencesEntry {
  return {
    name: 'developer',
    preferences: {
      role_families: [RoleFamilyEnum.BACKEND],
      places: places.map(place => ({ ...place, excluded_cities: [] })),
      excluded_companies: []
    }
  };
}

/**
 * A position of a board
 *
 * @param {Partial<IATSPosition>} changes
 *
 * @returns {IATSPosition}
 */
function position(changes: Partial<IATSPosition> = {}): IATSPosition {
  return {
    externalId: '1',
    url: 'https://job-boards.greenhouse.io/northwind/jobs/1',
    title: 'Backend Engineer',
    country: null,
    city: null,
    workMode: null,
    location: null,
    department: null,
    ...changes
  };
}

const HYBRID_IL = profile([{ country: 'IL', work_modes: [WorkModeEnum.HYBRID] }]);

const ANY_MODE_IL = profile([{ country: 'IL', work_modes: [WorkModeEnum.ONSITE, WorkModeEnum.HYBRID, WorkModeEnum.REMOTE] }]);

describe('positionPlaces', () => {
  it('keeps a position with its country and work mode', () => {
    const known = position({ country: 'IL', workMode: WorkModeEnum.HYBRID });

    expect(positionPlaces([known], [HYBRID_IL])).toEqual({ known: [known], unknown: 0 });
  });

  it('reads the country from the location when the board gives none', () => {
    const result = positionPlaces([position({ location: 'Haifa', workMode: WorkModeEnum.ONSITE })], [HYBRID_IL]);

    expect(result.known[0]?.country).toBe('IL');
    expect(result.unknown).toBe(0);
  });

  it('counts a position without a country as unknown', () => {
    expect(positionPlaces([position({ location: 'Somewhere' })], [HYBRID_IL])).toEqual({ known: [], unknown: 1 });
  });

  it('counts a position of a searched country without a work mode as unknown when the mode matters', () => {
    expect(positionPlaces([position({ country: 'IL' })], [HYBRID_IL])).toEqual({ known: [], unknown: 1 });
  });

  it('keeps a position without a work mode when the country is searched in every mode', () => {
    expect(positionPlaces([position({ country: 'IL' })], [ANY_MODE_IL]).known).toHaveLength(1);
  });

  it('keeps a position of a country nobody searches — the screening drops it later', () => {
    expect(positionPlaces([position({ country: 'US' })], [HYBRID_IL]).known).toHaveLength(1);
  });

  it('counts every position as unknown when no profile names a place and the board gives no country', () => {
    expect(positionPlaces([position({ location: 'Haifa' })], [])).toEqual({ known: [], unknown: 1 });
  });
});
