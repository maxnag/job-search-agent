import { describe, expect, it } from 'vitest';

import { LanguageLevelEnum, SkillKindEnum } from '@job-agent/shared';

import type { ResumeExtractionType } from '../schemas/resume-extraction.schema.js';
import { countExperienceYears, normalizeResumeLanguages, normalizeResumeSkills } from './resume-normalization.helper.js';

const NOW = new Date(2026, 10, 15);

const extraction = (overrides: Partial<ResumeExtractionType> = {}): ResumeExtractionType => ({
  positions: [
    {
      title: 'Senior Developer',
      company: 'Fictional Cinemas',
      start: '2025',
      end: null,
      skills: [
        { name: 'Node.js', kind: SkillKindEnum.FRAMEWORK },
        { name: 'TypeScript', kind: SkillKindEnum.PROGRAMMING_LANGUAGE }
      ]
    },
    {
      title: 'Developer',
      company: 'Fictional Health',
      start: '2019',
      end: '2024',
      skills: [
        { name: 'TypeScript', kind: SkillKindEnum.PROGRAMMING_LANGUAGE },
        { name: 'Java', kind: SkillKindEnum.PROGRAMMING_LANGUAGE }
      ]
    }
  ],
  claimed_skills: [{ name: 'TypeScript', kind: SkillKindEnum.PROGRAMMING_LANGUAGE }],
  languages: [],
  ...overrides
});

describe('normalizeResumeSkills', () => {
  it('counts the years of a skill over every job that names it', () => {
    const skills = normalizeResumeSkills(extraction(), NOW);

    expect(skills.find(skill => skill.key === 'typescript')?.years).toBeCloseTo(7.9, 5);
  });

  it('claims only the skills of the summary, not of a job stack', () => {
    const skills = normalizeResumeSkills(extraction(), NOW);

    expect(skills.find(skill => skill.key === 'typescript')?.isClaimed).toBe(true);
    expect(skills.find(skill => skill.key === 'java')?.isClaimed).toBe(false);
  });

  it('adds the periods of a skill to the skills it implies, without claiming them', () => {
    const javascript = normalizeResumeSkills(extraction(), NOW).find(skill => skill.key === 'javascript');

    expect(javascript).toMatchObject({ years: 7.9, isClaimed: false, kind: SkillKindEnum.PROGRAMMING_LANGUAGE });
  });

  it('merges spellings of one skill into one entry', () => {
    const skills = normalizeResumeSkills(
      extraction({
        positions: [
          { title: 'Developer', company: null, start: '2020', end: '2020', skills: [{ name: 'Node', kind: SkillKindEnum.TOOL }] }
        ],
        claimed_skills: [{ name: 'NodeJS', kind: SkillKindEnum.TOOL }]
      }),
      NOW
    );

    expect(skills.filter(skill => skill.key === 'nodejs')).toHaveLength(1);
  });

  it('takes the kind of a known skill from the dictionary, not from the LLM', () => {
    const skills = normalizeResumeSkills(extraction({ positions: [], claimed_skills: [{ name: 'PHP', kind: SkillKindEnum.TOOL }] }), NOW);

    expect(skills[0]?.kind).toBe(SkillKindEnum.PROGRAMMING_LANGUAGE);
  });

  it('keeps the LLM kind and the unknown flag for a skill the dictionary lacks', () => {
    const skills = normalizeResumeSkills(
      extraction({ positions: [], claimed_skills: [{ name: 'Oncology', kind: SkillKindEnum.DOMAIN }] }),
      NOW
    );

    expect(skills[0]).toMatchObject({ key: 'oncology', kind: SkillKindEnum.DOMAIN, isUnknown: true, years: null });
  });

  it('gives no years to a skill of a job without dates', () => {
    const skills = normalizeResumeSkills(
      extraction({
        positions: [
          { title: 'Developer', company: null, start: null, end: null, skills: [{ name: 'PHP', kind: SkillKindEnum.PROGRAMMING_LANGUAGE }] }
        ],
        claimed_skills: []
      }),
      NOW
    );

    expect(skills[0]?.years).toBeNull();
  });
});

describe('countExperienceYears', () => {
  it('counts every dated job, overlaps once', () => {
    expect(countExperienceYears(extraction().positions, NOW)).toBeCloseTo(7.9, 5);
  });

  it('returns null without dated jobs', () => {
    expect(countExperienceYears([], NOW)).toBeNull();
  });
});

describe('normalizeResumeLanguages', () => {
  it('keeps one language per code with the highest level, lower-casing the code', () => {
    expect(
      normalizeResumeLanguages([
        { name: 'Hebrew', code: 'HE', level: LanguageLevelEnum.BASIC },
        { name: 'Hebrew', code: 'he', level: LanguageLevelEnum.INTERMEDIATE },
        { name: 'English', code: 'en', level: LanguageLevelEnum.FLUENT }
      ])
    ).toEqual([
      { code: 'he', level: LanguageLevelEnum.INTERMEDIATE },
      { code: 'en', level: LanguageLevelEnum.FLUENT }
    ]);
  });

  it('does not lower a level already seen', () => {
    expect(
      normalizeResumeLanguages([
        { name: 'English', code: 'en', level: LanguageLevelEnum.NATIVE },
        { name: 'English', code: 'en', level: LanguageLevelEnum.BASIC }
      ])
    ).toEqual([{ code: 'en', level: LanguageLevelEnum.NATIVE }]);
  });
});
