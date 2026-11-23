/**
 * Why a page was not fetched: `FETCH_FAILED` is transient and retried (timeout, network, 5xx, 408, unreachable
 * `robots.txt`); the others are permanent for this run. `PRIVATE_ADDRESS` — the host resolves to the owner's machine,
 * the LAN or the cloud metadata endpoint, never requested
 */
export enum CrawlErrorCodeEnum {
  INVALID_URL = 'INVALID_URL',
  ROBOTS_DISALLOWED = 'ROBOTS_DISALLOWED',
  SOURCE_BLOCKED = 'SOURCE_BLOCKED',
  FETCH_FAILED = 'FETCH_FAILED',
  FETCH_HTTP_ERROR = 'FETCH_HTTP_ERROR',
  PRIVATE_ADDRESS = 'PRIVATE_ADDRESS'
}
