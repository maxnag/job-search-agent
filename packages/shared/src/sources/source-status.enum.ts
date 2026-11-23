/**
 * State of a source set by the crawler: `blocked_by_robots` — its `robots.txt` forbids the path, no request is made;
 * `blocked` — the site answered 403, 429 or a captcha, the crawler backed off
 */
export enum SourceStatusEnum {
  OK = 'ok',
  BLOCKED_BY_ROBOTS = 'blocked_by_robots',
  BLOCKED = 'blocked'
}
