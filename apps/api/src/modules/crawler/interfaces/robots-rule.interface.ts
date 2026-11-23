/**
 * One `Allow` / `Disallow` line of the `*` group of a robots.txt
 */
export interface IRobotsRule {
  /**
   * True for `Allow`
   *
   * @var {boolean}
   */
  readonly allow: boolean;

  /**
   * Path pattern as written, with `*` and a trailing `$`
   *
   * @var {string}
   */
  readonly pattern: string;
}
