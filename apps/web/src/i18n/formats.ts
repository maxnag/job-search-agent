import type { Formats } from 'next-intl';

/**
 * Named formats of the interface — the one place a date is shaped. A date carries a 24-hour time in either language
 * (`hourCycle: 'h23'`), never AM / PM
 *
 * @type {Formats}
 */
export const formats = {
  dateTime: {
    dateTime: { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }
  }
} satisfies Formats;
