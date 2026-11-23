/**
 * A resume version made current and the owner's hidden skills it carries over
 */
export interface ICurrentResume {
  /**
   * Id of the current version
   *
   * @var {number}
   */
  readonly resumeId: number;

  /**
   * Keys of the skills hidden on the previous current version and hidden on this one too
   *
   * @var {readonly string[]}
   */
  readonly hiddenSkillKeys: readonly string[];
}
