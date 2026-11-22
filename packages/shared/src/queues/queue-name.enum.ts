/**
 * Names of the BullMQ queues of the pipeline
 */
export enum QueueNameEnum {
  SEARCH = 'search',
  EMAIL = 'email',
  EXTRACT = 'extract',
  NOTIFY = 'notify'
}

/**
 * Every queue of the pipeline, in pipeline order
 *
 * @type {readonly QueueNameEnum[]}
 */
export const QUEUE_NAMES: readonly QueueNameEnum[] = Object.values(QueueNameEnum);
