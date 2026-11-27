/**
 * Names of the jobs added to the pipeline queues
 */
export enum JobNameEnum {
  SCAN_SOURCES = 'scan-sources',
  SCAN_SOURCE = 'scan-source',
  DISCOVER_SOURCES = 'discover-sources',
  EXTRACT_VACANCY = 'extract-vacancy',
  VACANCY_MATCHED = 'vacancy-matched',
  VACANCY_CLOSED = 'vacancy-closed',
  VACANCY_CHANGED = 'vacancy-changed',
  VACANCY_ACTION_SYNC = 'vacancy-action-sync',
  SOURCE_BLOCKED = 'source-blocked',
  SOURCE_CANDIDATE = 'source-candidate',
  NOTIFY_PENDING = 'notify-pending',
  READ_JOB_MAIL = 'read-job-mail',
  JOB_MAIL_DISABLED = 'job-mail-disabled'
}
