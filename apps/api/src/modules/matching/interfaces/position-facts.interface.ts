import type { RoleFamilyEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * What both a listing line and a vacancy page tell about a position — the rules on company, role, level and place
 * read it. A null field is unknown and never drops a position
 */
export interface IPositionFacts {
  /**
   * Company
   *
   * @var {string}
   */
  readonly company: string;

  /**
   * Family of the role; unknown on a vacancy page
   *
   * @var {RoleFamilyEnum | null}
   */
  readonly roleFamily: RoleFamilyEnum | null;

  /**
   * Level
   *
   * @var {SeniorityLevelEnum | null}
   */
  readonly level: SeniorityLevelEnum | null;

  /**
   * ISO 3166-1 alpha-2 country code, upper case
   *
   * @var {string | null}
   */
  readonly country: string | null;

  /**
   * City
   *
   * @var {string | null}
   */
  readonly city: string | null;

  /**
   * Work mode
   *
   * @var {WorkModeEnum | null}
   */
  readonly workMode: WorkModeEnum | null;
}
