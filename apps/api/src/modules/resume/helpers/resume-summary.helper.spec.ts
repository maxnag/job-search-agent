import { describe, expect, it } from 'vitest';

import { LanguageLevelEnum, SkillKindEnum } from '@job-agent/shared';

import { ResumeImportStatusEnum } from '../enums/resume-import-status.enum.js';
import type { IResumeImportResult } from '../interfaces/resume-import.interface.js';
import { formatResumeSummary } from './resume-summary.helper.js';

const created: IResumeImportResult = {
  status: ResumeImportStatusEnum.CREATED,
  profileName: 'developer',
  profileId: 1,
  resumeId: 2,
  hiddenSkillKeys: ['java'],
  extracted: {
    data: { positions: [], claimed_skills: [], languages: [] },
    model: 'claude-haiku-5-5',
    experienceYears: 19.9,
    skills: [
      { key: 'typescript', name: 'TypeScript', kind: SkillKindEnum.PROGRAMMING_LANGUAGE, years: 7.9, isUnknown: false, isClaimed: true },
      { key: 'java', name: 'Java', kind: SkillKindEnum.PROGRAMMING_LANGUAGE, years: 7.9, isUnknown: false, isClaimed: false },
      { key: 'oncology', name: 'Oncology', kind: SkillKindEnum.DOMAIN, years: null, isUnknown: true, isClaimed: false }
    ],
    languages: [{ code: 'en', level: LanguageLevelEnum.FLUENT }]
  }
};

describe('formatResumeSummary', () => {
  it('prints the head only for a version that was not extracted again', () => {
    expect(
      formatResumeSummary({
        status: ResumeImportStatusEnum.UNCHANGED,
        profileName: 'developer',
        profileId: 1,
        resumeId: 2,
        hiddenSkillKeys: []
      })
    ).toBe('Profile "developer" (#1) — resume #2: unchanged\n');
  });

  it('lists the visible skills by kind with years and the claimed mark', () => {
    expect(formatResumeSummary(created)).toContain('Programming languages: TypeScript (7.9y, claimed)\n');
  });

  it('moves the hidden skills to their own line', () => {
    const summary = formatResumeSummary(created);

    expect(summary).toContain('Hidden by you: Java (7.9y)');
    expect(summary).not.toMatch(/Programming languages:.*Java/);
  });

  it('lists the skills the dictionary lacks with their keys', () => {
    expect(formatResumeSummary(created)).toContain('Not in the skill dictionary: Oncology → oncology');
  });

  it('prints experience, model and languages', () => {
    const summary = formatResumeSummary(created);

    expect(summary).toContain('Experience: 19.9 years');
    expect(summary).toContain('Model: claude-haiku-5-5');
    expect(summary).toContain('Languages: en fluent');
  });
});
