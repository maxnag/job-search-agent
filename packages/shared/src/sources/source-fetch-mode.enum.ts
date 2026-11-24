/**
 * How the listing of a source is loaded: a plain request, rendered in a headless browser for lists drawn by
 * JavaScript, through the public job board of the applicant tracking system the company publishes its positions in,
 * or from the job alerts e-mailed from one sender domain — such a source is created by the mail reading, never scanned
 */
export enum SourceFetchModeEnum {
  HTML = 'html',
  RENDERED = 'rendered',
  ATS = 'ats',
  JOB_MAIL = 'job_mail'
}
