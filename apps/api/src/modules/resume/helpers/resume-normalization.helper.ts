import { LanguageLevelEnum, type SkillKindEnum, findSkillByKey, normalizeSkill } from '@job-agent/shared';

import type { IResumeLanguage, IResumeSkill } from '../interfaces/extracted-resume.interface.js';
import type { IMonthRange } from '../interfaces/month-range.interface.js';
import type { ResumeExtractionType } from '../schemas/resume-extraction.schema.js';
import { countYears, toMonthRange } from './experience.helper.js';

/**
 * Language levels from the highest to the lowest
 *
 * @type {readonly LanguageLevelEnum[]}
 */
const LEVEL_ORDER: readonly LanguageLevelEnum[] = Object.values(LanguageLevelEnum);

/**
 * A skill being assembled from the jobs and the summary of a resume
 */
interface ISkillDraft {
  /**
   * Name shown for the skill
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Kind of the skill
   *
   * @var {SkillKindEnum}
   */
  readonly kind: SkillKindEnum;

  /**
   * True when the dictionary does not know the skill
   *
   * @var {boolean}
   */
  readonly isUnknown: boolean;

  /**
   * Stated in the summary or skills section
   *
   * @var {boolean}
   */
  isClaimed: boolean;

  /**
   * Periods of the jobs that name it, directly or through a skill that implies it
   *
   * @var {IMonthRange[]}
   */
  readonly ranges: IMonthRange[];
}

/**
 * Draft of a skill, created on first sight
 *
 * @param {Map<string, ISkillDraft>} drafts
 * @param {{ name: string; kind: SkillKindEnum }} skill
 * @param skill.name
 * @param skill.kind
 *
 * @returns {ISkillDraft | undefined} Undefined for a name that normalizes to nothing
 */
function draftOf(drafts: Map<string, ISkillDraft>, skill: { name: string; kind: SkillKindEnum }): ISkillDraft | undefined {
  const normalized = normalizeSkill(skill.name);

  if (!normalized.key) {
    return undefined;
  }

  const existing = drafts.get(normalized.key);

  if (existing) {
    return existing;
  }

  const draft = { name: skill.name, kind: normalized.kind ?? skill.kind, isUnknown: normalized.isUnknown, isClaimed: false, ranges: [] };

  drafts.set(normalized.key, draft);

  return draft;
}

/**
 * Add a job period to the skills a named skill implies (TypeScript → JavaScript); claiming is not passed on
 *
 * @param {Map<string, ISkillDraft>} drafts
 * @param {string} name
 * @param {IMonthRange} range
 *
 * @returns {void}
 */
function addImplied(drafts: Map<string, ISkillDraft>, name: string, range: IMonthRange): void {
  for (const key of normalizeSkill(name).implies) {
    const implied = findSkillByKey(key);

    if (implied) {
      draftOf(drafts, { name: implied.name, kind: implied.kind })?.ranges.push(range);
    }
  }
}

/**
 * Total years of experience: every job period, overlaps counted once
 *
 * @param {ResumeExtractionType['positions']} positions
 * @param {Date} now
 *
 * @returns {number | null}
 */
export function countExperienceYears(positions: ResumeExtractionType['positions'], now: Date): number | null {
  const ranges = positions.map(position => toMonthRange(position.start, position.end, now)).filter(range => range !== undefined);

  return countYears(ranges);
}

/**
 * Skills of a resume by the dictionary: years from the periods of the jobs that name them (overlaps once),
 * claimed when the summary or skills section states them. The dictionary decides the kind of a known skill
 *
 * @param {ResumeExtractionType} extraction
 * @param {Date} now
 *
 * @returns {IResumeSkill[]}
 */
export function normalizeResumeSkills(extraction: ResumeExtractionType, now: Date): IResumeSkill[] {
  const drafts = new Map<string, ISkillDraft>();

  for (const position of extraction.positions) {
    const range = toMonthRange(position.start, position.end, now);

    for (const skill of position.skills) {
      const draft = draftOf(drafts, skill);

      if (draft && range) {
        draft.ranges.push(range);
        addImplied(drafts, skill.name, range);
      }
    }
  }

  for (const skill of extraction.claimed_skills) {
    const draft = draftOf(drafts, skill);

    if (draft) {
      draft.isClaimed = true;
    }
  }

  return [...drafts.entries()].map(([key, draft]) => ({
    key,
    name: draft.name,
    kind: draft.kind,
    years: countYears(draft.ranges),
    isUnknown: draft.isUnknown,
    isClaimed: draft.isClaimed
  }));
}

/**
 * One language per code, keeping the highest level
 *
 * @param {ResumeExtractionType['languages']} extracted
 *
 * @returns {IResumeLanguage[]}
 */
export function normalizeResumeLanguages(extracted: ResumeExtractionType['languages']): IResumeLanguage[] {
  const languages = new Map<string, IResumeLanguage>();

  for (const language of extracted) {
    const code = language.code.toLowerCase();
    const previous = languages.get(code);

    if (!previous || LEVEL_ORDER.indexOf(language.level) < LEVEL_ORDER.indexOf(previous.level)) {
      languages.set(code, { code, level: language.level });
    }
  }

  return [...languages.values()];
}
