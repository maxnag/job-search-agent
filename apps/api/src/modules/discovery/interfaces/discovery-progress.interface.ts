import type { DiscoveryStageEnum } from '../enums/discovery-stage.enum.js';

/**
 * One step of a discovery run, for a command to show how far it is
 */
export interface IDiscoveryProgress {
  /**
   * What the step is
   *
   * @var {DiscoveryStageEnum}
   */
  readonly stage: DiscoveryStageEnum;

  /**
   * Steps of the stage done, this one included
   *
   * @var {number}
   */
  readonly done: number;

  /**
   * Steps of the stage in all
   *
   * @var {number}
   */
  readonly total: number;

  /**
   * The board read — the applicant tracking system and the board; absent for a query
   *
   * @var {string | undefined}
   */
  readonly board?: string;
}
