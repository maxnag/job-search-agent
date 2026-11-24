import type { ATSKindEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * A published position of a board, in the fields every applicant tracking system can give; values are clipped
 */
export interface IATSPosition {
  /**
   * Id of the position in the applicant tracking system
   *
   * @var {string}
   */
  readonly externalId: string;

  /**
   * Public page of the position
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Title of the position
   *
   * @var {string}
   */
  readonly title: string;

  /**
   * Country as ISO 3166-1 alpha-2, when the system gives it as a field
   *
   * @var {string | null}
   */
  readonly country: string | null;

  /**
   * City, when the system gives it as a field
   *
   * @var {string | null}
   */
  readonly city: string | null;

  /**
   * Work mode, when the system gives it as a field
   *
   * @var {WorkModeEnum | null}
   */
  readonly workMode: WorkModeEnum | null;

  /**
   * Location as the company wrote it
   *
   * @var {string | null}
   */
  readonly location: string | null;

  /**
   * Department or team
   *
   * @var {string | null}
   */
  readonly department: string | null;
}

/**
 * The published positions of a board
 */
export interface IATSListing {
  /**
   * Name of the company, when the board gives it
   *
   * @var {string | null}
   */
  readonly company: string | null;

  /**
   * Every published position
   *
   * @var {readonly IATSPosition[]}
   */
  readonly positions: readonly IATSPosition[];
}

/**
 * The position to read the posting of
 */
export interface IATSPostingRequest {
  /**
   * The board within the system
   *
   * @var {string}
   */
  readonly board: string;

  /**
   * Id of the position in the system
   *
   * @var {string}
   */
  readonly externalId: string;

  /**
   * Public page of the position
   *
   * @var {string}
   */
  readonly url: string;
}

/**
 * Reads the public job board of one applicant tracking system; politeness belongs to the crawler it calls
 */
export interface IATSClient {
  /**
   * The system the client reads
   *
   * @var {ATSKindEnum}
   */
  readonly kind: ATSKindEnum;

  /**
   * Every published position of a board
   *
   * @param {string} board
   * @param {number} [timeoutMs] Limit of the request instead of the crawler's own
   *
   * @returns {Promise<IATSListing>}
   */
  listPositions(board: string, timeoutMs?: number): Promise<IATSListing>;

  /**
   * The posting of one position as HTML: its title, place and work mode, then the description
   *
   * @param {IATSPostingRequest} request
   *
   * @returns {Promise<string>}
   */
  fetchPosting(request: IATSPostingRequest): Promise<string>;
}
