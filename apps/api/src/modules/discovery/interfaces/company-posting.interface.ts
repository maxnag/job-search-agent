/**
 * A vacancy found on the board of its company
 */
export interface ICompanyPosting {
  /**
   * Address of the posting on the board
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Id of the position in the applicant tracking system
   *
   * @var {string}
   */
  readonly externalId: string;
}
