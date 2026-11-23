/**
 * Data of a `scan-source` job
 */
export interface IScanSourceJob {
  /**
   * Source to scan
   *
   * @var {number}
   */
  readonly sourceId: number;

  /**
   * Scan a source switched off or stopped by the crawler — the owner asked for it by hand
   *
   * @var {boolean}
   */
  readonly force?: boolean;
}
