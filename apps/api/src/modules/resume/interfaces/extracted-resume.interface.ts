import type { LanguageLevelEnum, SkillKindEnum } from '@job-agent/shared';

import type { ResumeExtractionType } from '../schemas/resume-extraction.schema.js';

/**
 * A skill of a resume mapped onto the skill dictionary
 */
export interface IResumeSkill {
  /**
   * Canonical key of the skill
   *
   * @var {string}
   */
  readonly key: string;

  /**
   * Name as written in the resume
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Kind from the dictionary, or from the LLM for an unknown skill
   *
   * @var {SkillKindEnum}
   */
  readonly kind: SkillKindEnum;

  /**
   * Years of the jobs that name it, overlaps counted once; null when no dated job names it
   *
   * @var {number | null}
   */
  readonly years: number | null;

  /**
   * True when the dictionary does not know the skill
   *
   * @var {boolean}
   */
  readonly isUnknown: boolean;

  /**
   * Stated in the summary or skills section, not only named in the stack of a job
   *
   * @var {boolean}
   */
  readonly isClaimed: boolean;
}

/**
 * A spoken language of a resume
 */
export interface IResumeLanguage {
  /**
   * ISO 639-1 code
   *
   * @var {string}
   */
  readonly code: string;

  /**
   * Level
   *
   * @var {LanguageLevelEnum}
   */
  readonly level: LanguageLevelEnum;
}

/**
 * A resume after extraction and normalization
 */
export interface IExtractedResume {
  /**
   * Validated answer of the LLM, stored as is
   *
   * @var {ResumeExtractionType}
   */
  readonly data: ResumeExtractionType;

  /**
   * Model that extracted it
   *
   * @var {string}
   */
  readonly model: string;

  /**
   * Total years of the dated jobs, counted by code
   *
   * @var {number | null}
   */
  readonly experienceYears: number | null;

  /**
   * Skills, one per dictionary key
   *
   * @var {readonly IResumeSkill[]}
   */
  readonly skills: readonly IResumeSkill[];

  /**
   * Spoken languages, one per code
   *
   * @var {readonly IResumeLanguage[]}
   */
  readonly languages: readonly IResumeLanguage[];
}
