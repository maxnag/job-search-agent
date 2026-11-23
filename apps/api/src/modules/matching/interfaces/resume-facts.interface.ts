/**
 * What the current resume version of a profile offers to the matching code
 */
export interface IResumeFacts {
  /**
   * Keys of the skills the owner did not hide, implied ones included
   *
   * @var {ReadonlySet<string>}
   */
  readonly skillKeys: ReadonlySet<string>;

  /**
   * Total years of experience; null when the resume dates no job
   *
   * @var {number | null}
   */
  readonly experienceYears: number | null;
}
