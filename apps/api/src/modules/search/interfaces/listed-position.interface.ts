import type { RoleFamilyEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * A position of a listing page, classified by the LLM from its title and the text around it
 */
export interface IListedPosition {
  /**
   * URL of the vacancy page
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Title as the page writes it
   *
   * @var {string}
   */
  readonly title: string;

  /**
   * Company — the source's name when the page does not name one
   *
   * @var {string}
   */
  readonly company: string;

  /**
   * ISO 3166-1 alpha-2 code of the country, upper case
   *
   * @var {string | null}
   */
  readonly country: string | null;

  /**
   * City in English
   *
   * @var {string | null}
   */
  readonly city: string | null;

  /**
   * Work mode, when the page states it
   *
   * @var {WorkModeEnum | null}
   */
  readonly workMode: WorkModeEnum | null;

  /**
   * Family of the role
   *
   * @var {RoleFamilyEnum}
   */
  readonly roleFamily: RoleFamilyEnum;

  /**
   * Level named in the title
   *
   * @var {SeniorityLevelEnum | null}
   */
  readonly level: SeniorityLevelEnum | null;
}
