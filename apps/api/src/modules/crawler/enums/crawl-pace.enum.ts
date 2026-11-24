/**
 * How long the crawler waits between two requests to one host: a site made for people gets the long pause, a public
 * API made for programs — such as a job-board API of an ATS — the short one
 */
export enum CrawlPaceEnum {
  SITE = 'site',
  API = 'api'
}
