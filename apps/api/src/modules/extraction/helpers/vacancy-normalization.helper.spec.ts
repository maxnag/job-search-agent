import { describe, expect, it } from 'vitest';

import { HebrewRequirementEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

import type { VacancyExtractionType } from '../schemas/vacancy-extraction.schema.js';
import { normalizeVacancyExtraction } from './vacancy-normalization.helper.js';

/**
 * An extraction with the given changes
 *
 * @param {Partial<VacancyExtractionType>} changes
 *
 * @returns {VacancyExtractionType}
 */
function extraction(changes: Partial<VacancyExtractionType> = {}): VacancyExtractionType {
  return {
    is_open: true,
    title: 'Backend Developer',
    company: 'Northwind',
    level: SeniorityLevelEnum.SENIOR,
    country: 'il',
    city: 'Haifa',
    work_mode: WorkModeEnum.HYBRID,
    programming_languages: [],
    frameworks: [],
    years_required: 5,
    hebrew: HebrewRequirementEnum.NONE,
    summary: 'Builds the shipment API.',
    ...changes
  };
}

/**
 * The keys of a list of skills
 *
 * @param {readonly { key: string }[]} skills
 *
 * @returns {string[]}
 */
function keys(skills: readonly { key: string }[]): string[] {
  return skills.map(skill => skill.key);
}

describe('normalizeVacancyExtraction', () => {
  it('copies the facts, upper-cases the country and names the model', () => {
    expect(normalizeVacancyExtraction(extraction(), 'claude-haiku-5-5')).toEqual({
      title: 'Backend Developer',
      company: 'Northwind',
      level: SeniorityLevelEnum.SENIOR,
      country: 'IL',
      city: 'Haifa',
      workMode: WorkModeEnum.HYBRID,
      requiredLanguages: [],
      preferredLanguages: [],
      frameworks: [],
      yearsRequired: 5,
      hebrew: HebrewRequirementEnum.NONE,
      summary: 'Builds the shipment API.',
      model: 'claude-haiku-5-5'
    });
  });

  it('splits the languages into required and nice to have, mapped onto the dictionary', () => {
    const data = normalizeVacancyExtraction(
      extraction({
        programming_languages: [
          { name: 'TS', required: true },
          { name: 'Python', required: false }
        ]
      }),
      'm'
    );

    expect(data.requiredLanguages).toEqual([{ key: 'typescript', name: 'TypeScript', isUnknown: false }]);
    expect(keys(data.preferredLanguages)).toEqual(['python']);
  });

  it('lets the dictionary decide: a framework named as a language goes to the frameworks', () => {
    const data = normalizeVacancyExtraction(extraction({ programming_languages: [{ name: 'Node.js', required: true }] }), 'm');

    expect(keys(data.requiredLanguages)).toEqual([]);
    expect(keys(data.frameworks)).toEqual(['nodejs']);
  });

  it('lets the dictionary decide: a language named among the frameworks becomes a required language', () => {
    const data = normalizeVacancyExtraction(extraction({ frameworks: ['React', 'Java'] }), 'm');

    expect(keys(data.requiredLanguages)).toEqual(['java']);
    expect(keys(data.frameworks)).toEqual(['react']);
  });

  it('trusts the LLM for a name the dictionary does not know, and flags it', () => {
    const data = normalizeVacancyExtraction(
      extraction({ programming_languages: [{ name: 'Zig', required: true }], frameworks: ['Qwik'] }),
      'm'
    );

    expect(data.requiredLanguages).toEqual([{ key: 'zig', name: 'Zig', isUnknown: true }]);
    expect(data.frameworks).toEqual([{ key: 'qwik', name: 'Qwik', isUnknown: true }]);
  });

  it('counts a language both required and nice to have as required, once', () => {
    const data = normalizeVacancyExtraction(
      extraction({
        programming_languages: [
          { name: 'PHP', required: false },
          { name: 'php', required: true },
          { name: 'PHP', required: true }
        ]
      }),
      'm'
    );

    expect(keys(data.requiredLanguages)).toEqual(['php']);
    expect(keys(data.preferredLanguages)).toEqual([]);
  });

  it('drops a name that gives no key and one longer than the limit', () => {
    const data = normalizeVacancyExtraction(extraction({ frameworks: ['---', 'x'.repeat(61), 'y'.repeat(60)] }), 'm');

    expect(keys(data.frameworks)).toEqual(['y'.repeat(60)]);
  });

  it('clips text fields a page planted too long', () => {
    const data = normalizeVacancyExtraction(
      extraction({ title: 't'.repeat(500), company: 'c'.repeat(500), city: 'k'.repeat(500), summary: 's'.repeat(5000) }),
      'm'
    );

    expect([data.title.length, data.company?.length, data.city?.length, data.summary.length]).toEqual([200, 120, 80, 1000]);
  });

  it('keeps no more than fifty skills of a kind', () => {
    const data = normalizeVacancyExtraction(extraction({ frameworks: Array.from({ length: 80 }, (_, index) => `tool-${index}`) }), 'm');

    expect(data.frameworks).toHaveLength(50);
  });

  it('keeps absent company, city and country absent', () => {
    expect(normalizeVacancyExtraction(extraction({ company: null, city: null, country: null }), 'm')).toMatchObject({
      company: null,
      city: null,
      country: null
    });
  });
});
