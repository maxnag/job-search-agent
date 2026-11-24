/**
 * How the listing of a source is loaded: a plain request, rendered in a headless browser for lists drawn by
 * JavaScript, or through the public job board of the applicant tracking system the company publishes its positions in
 */
export enum SourceFetchModeEnum {
  HTML = 'html',
  RENDERED = 'rendered',
  ATS = 'ats'
}
