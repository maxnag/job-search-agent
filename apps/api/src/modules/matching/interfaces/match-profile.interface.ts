/**
 * A profile with its current resume version, as the matching code reads it
 */
export interface IMatchProfile {
  /**
   * Profile id
   *
   * @var {number}
   */
  readonly profileId: number;

  /**
   * Profile name
   *
   * @var {string}
   */
  readonly profileName: string;

  /**
   * `profile_preferences` as stored — validated before use
   *
   * @var {unknown}
   */
  readonly preferences: unknown;

  /**
   * Current resume version
   *
   * @var {number}
   */
  readonly resumeId: number;

  /**
   * Total years of experience of that version
   *
   * @var {number | null}
   */
  readonly experienceYears: number | null;

  /**
   * Keys of its skills the owner did not hide
   *
   * @var {readonly string[]}
   */
  readonly skillKeys: readonly string[];
}
