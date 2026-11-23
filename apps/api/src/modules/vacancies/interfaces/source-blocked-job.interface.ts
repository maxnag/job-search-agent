/**
 * Data of a `source-blocked` job: the crawler stopped a source, the owner is told
 */
export interface ISourceBlockedJob {
  /**
   * Source stopped — its `source_status` and `source_last_error` say why
   *
   * @var {number}
   */
  readonly sourceId: number;
}
