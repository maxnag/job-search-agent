import type { SkillKindEnum } from './skill-kind.enum.js';

/**
 * One skill of the dictionary
 */
export interface ISkillDefinition {
  /**
   * Canonical key stored in the database
   *
   * @var {string}
   */
  readonly key: string;

  /**
   * Display name
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
   * Other spellings found in resumes and vacancies
   *
   * @var {readonly string[]}
   */
  readonly aliases: readonly string[];

  /**
   * Keys of skills this one implies: writing TypeScript is writing JavaScript
   *
   * @var {readonly string[]}
   */
  readonly implies?: readonly string[];
}

/**
 * A skill name mapped onto the dictionary
 */
export interface INormalizedSkill {
  /**
   * Canonical key, or a slug of the name when the dictionary does not know it
   *
   * @var {string}
   */
  readonly key: string;

  /**
   * Display name from the dictionary, or the name as written
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Kind from the dictionary; absent for an unknown skill
   *
   * @var {SkillKindEnum}
   */
  readonly kind?: SkillKindEnum;

  /**
   * True when the dictionary does not know the skill
   *
   * @var {boolean}
   */
  readonly isUnknown: boolean;

  /**
   * Keys of the skills it implies
   *
   * @var {readonly string[]}
   */
  readonly implies: readonly string[];
}
