/**
 * Ids of the BullMQ Job Schedulers that start the pipeline on a schedule
 */
export enum SchedulerIdEnum {
  SCAN_SOURCES = 'scan-sources',
  DISCOVER_SOURCES = 'discover-sources',
  NOTIFY_PENDING = 'notify-pending'
}
