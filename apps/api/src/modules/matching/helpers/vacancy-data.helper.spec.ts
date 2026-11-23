import { describe, expect, it } from 'vitest';

import { HebrewRequirementEnum } from '@job-agent/shared';

import { readVacancyData } from './vacancy-data.helper.js';

const DATA = { title: 'Developer', requiredLanguages: [], preferredLanguages: [], hebrew: HebrewRequirementEnum.NONE };

describe('readVacancyData', () => {
  it('reads stored extraction data', () => {
    expect(readVacancyData(DATA)).toBe(DATA);
  });

  it('gives nothing for a vacancy not extracted yet', () => {
    expect(readVacancyData(null)).toBeUndefined();
  });

  it.each([
    ['required languages', { ...DATA, requiredLanguages: undefined }],
    ['preferred languages', { ...DATA, preferredLanguages: 'TypeScript' }],
    ['Hebrew', { ...DATA, hebrew: undefined }]
  ])('gives nothing for data without %s — an older shape', (_field, data) => {
    expect(readVacancyData(data)).toBeUndefined();
  });
});
