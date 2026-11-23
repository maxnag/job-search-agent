import { SkillKindEnum } from '@job-agent/shared';

import { ResumeImportStatusEnum } from '../enums/resume-import-status.enum.js';
import type { IResumeSkill } from '../interfaces/extracted-resume.interface.js';
import { type IResumeImportResult } from '../interfaces/resume-import.interface.js';

/**
 * Heading of every skill kind in the summary
 *
 * @type {Readonly<Record<SkillKindEnum, string>>}
 */
const KIND_HEADINGS: Readonly<Record<SkillKindEnum, string>> = {
  [SkillKindEnum.PROGRAMMING_LANGUAGE]: 'Programming languages',
  [SkillKindEnum.FRAMEWORK]: 'Frameworks and libraries',
  [SkillKindEnum.TOOL]: 'Tools',
  [SkillKindEnum.METHOD]: 'Methods',
  [SkillKindEnum.DOMAIN]: 'Domains',
  [SkillKindEnum.CERTIFICATION]: 'Certifications',
  [SkillKindEnum.OTHER]: 'Other'
};

/**
 * A skill with its years and whether the candidate claims it
 *
 * @param {IResumeSkill} skill
 *
 * @returns {string}
 */
function formatSkill(skill: IResumeSkill): string {
  const details = [skill.years === null ? undefined : `${skill.years}y`, skill.isClaimed ? 'claimed' : undefined].filter(Boolean);

  return details.length > 0 ? `${skill.name} (${details.join(', ')})` : skill.name;
}

/**
 * Text the import command prints: what happened, the extracted profile, the skills the dictionary lacks
 *
 * @param {IResumeImportResult} result
 *
 * @returns {string}
 */
export function formatResumeSummary(result: IResumeImportResult): string {
  const head = `Profile "${result.profileName}" (#${result.profileId}) — resume #${result.resumeId}: ${result.status}`;

  if (result.status !== ResumeImportStatusEnum.CREATED || !result.extracted) {
    return `${head}\n`;
  }

  const { extracted } = result;
  const hidden = new Set(result.hiddenSkillKeys);
  const visible = extracted.skills.filter(skill => !hidden.has(skill.key));
  const lines = [head, `Model: ${extracted.model}`, `Experience: ${extracted.experienceYears ?? '—'} years`];

  for (const kind of Object.values(SkillKindEnum)) {
    const skills = visible.filter(skill => skill.kind === kind);

    if (skills.length > 0) {
      lines.push(`${KIND_HEADINGS[kind]}: ${skills.map(formatSkill).join(', ')}`);
    }
  }

  const languages = extracted.languages.map(language => [language.code, language.level].join(' ')).join(', ');

  lines.push(`Languages: ${languages || '—'}`);

  if (hidden.size > 0) {
    lines.push(
      `Hidden by you: ${extracted.skills
        .filter(skill => hidden.has(skill.key))
        .map(formatSkill)
        .join(', ')}`
    );
  }

  const unknown = visible.filter(skill => skill.isUnknown);

  if (unknown.length > 0) {
    const names = unknown.map(skill => [skill.name, skill.key].join(' → ')).join(', ');

    lines.push(`Not in the skill dictionary: ${names}`);
  }

  return `${lines.join('\n')}\n`;
}
