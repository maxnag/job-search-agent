/**
 * Names of the jobs added to the pipeline queues
 */
export enum JobNameEnum {
  SCAN_SOURCES = 'scan-sources',
  SCAN_SOURCE = 'scan-source',
  EXTRACT_VACANCY = 'extract-vacancy',
  VACANCY_MATCHED = 'vacancy-matched',
  VACANCY_CLOSED = 'vacancy-closed',
  VACANCY_CHANGED = 'vacancy-changed',
  SOURCE_BLOCKED = 'source-blocked',
  NOTIFY_PENDING = 'notify-pending'
}
