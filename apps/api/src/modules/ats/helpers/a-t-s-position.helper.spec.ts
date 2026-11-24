import { describe, expect, it } from 'vitest';

import { WorkModeEnum } from '@job-agent/shared';

import type { IATSPosition } from '../interfaces/a-t-s-client.interface.js';
import { atsWorkMode, clipATSPosition } from './a-t-s-position.helper.js';

/**
 * A position as an applicant tracking system returns it
 *
 * @param {Partial<IATSPosition>} overrides
 *
 * @returns {IATSPosition}
 */
function position(overrides: Partial<IATSPosition> = {}): IATSPosition {
  return {
    externalId: '101',
    url: 'https://job-boards.greenhouse.io/northwind/jobs/101',
    title: ' Backend Engineer ',
    country: ' il ',
    city: ' Haifa ',
    workMode: WorkModeEnum.HYBRID,
    location: ' Haifa, Israel ',
    department: ' R&D ',
    ...overrides
  };
}

describe('clipATSPosition', () => {
  it('trims the fields and upper-cases the country', () => {
    expect(clipATSPosition(position())).toEqual({
      externalId: '101',
      url: 'https://job-boards.greenhouse.io/northwind/jobs/101',
      title: 'Backend Engineer',
      country: 'IL',
      city: 'Haifa',
      workMode: WorkModeEnum.HYBRID,
      location: 'Haifa, Israel',
      department: 'R&D'
    });
  });

  it.each(['Israel', 'ISR', '', null])('drops the country %j that is not a two-letter code', country => {
    expect(clipATSPosition(position({ country })).country).toBeNull();
  });

  it('turns blank optional fields into null', () => {
    const clipped = clipATSPosition(position({ city: '  ', location: '', department: null }));

    expect(clipped.city).toBeNull();
    expect(clipped.location).toBeNull();
    expect(clipped.department).toBeNull();
  });

  it('clips the long fields', () => {
    const clipped = clipATSPosition(position({ title: 'T'.repeat(500), location: 'L'.repeat(500), department: 'D'.repeat(500) }));

    expect(clipped.title).toHaveLength(200);
    expect(clipped.location).toHaveLength(200);
    expect(clipped.department).toHaveLength(80);
  });
});

describe('atsWorkMode', () => {
  it.each([
    ['On-site', WorkModeEnum.ONSITE],
    ['onsite', WorkModeEnum.ONSITE],
    [' Hybrid ', WorkModeEnum.HYBRID],
    ['REMOTE', WorkModeEnum.REMOTE]
  ])('reads %j', (value, mode) => {
    expect(atsWorkMode(value)).toBe(mode);
  });

  it.each(['flexible', '', null, undefined])('gives null for %j', value => {
    expect(atsWorkMode(value)).toBeNull();
  });
});
