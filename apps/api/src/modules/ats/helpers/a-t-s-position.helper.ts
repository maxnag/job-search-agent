import { WorkModeEnum } from '@job-agent/shared';

import { VACANCY_FIELD_LIMITS, clipNullable, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import type { IATSPosition } from '../interfaces/a-t-s-client.interface.js';

/**
 * Longest location and department kept — a board is text from the web
 *
 * @type {Readonly<{ location: number; department: number }>}
 */
const POSITION_FIELD_LIMITS = { location: 200, department: 80 } as const;

/**
 * An ISO 3166-1 alpha-2 country code
 *
 * @type {RegExp}
 */
const COUNTRY_CODE = /^[A-Z]{2}$/;

/**
 * Work modes as the boards write them, lower case
 *
 * @type {ReadonlyMap<string, WorkModeEnum>}
 */
const WORK_MODES: ReadonlyMap<string, WorkModeEnum> = new Map([
  ['on-site', WorkModeEnum.ONSITE],
  ['onsite', WorkModeEnum.ONSITE],
  ['hybrid', WorkModeEnum.HYBRID],
  ['remote', WorkModeEnum.REMOTE]
]);

/**
 * A position with every field clipped, an empty value made null and the country checked
 *
 * @param {IATSPosition} position
 *
 * @returns {IATSPosition}
 */
export function clipATSPosition(position: IATSPosition): IATSPosition {
  const country = position.country?.trim().toUpperCase() ?? '';

  return {
    externalId: position.externalId,
    url: position.url,
    title: clipText(position.title.trim(), VACANCY_FIELD_LIMITS.title),
    country: COUNTRY_CODE.test(country) ? country : null,
    city: clipNullable(position.city?.trim() || null, VACANCY_FIELD_LIMITS.city),
    workMode: position.workMode,
    location: clipNullable(position.location?.trim() || null, POSITION_FIELD_LIMITS.location),
    department: clipNullable(position.department?.trim() || null, POSITION_FIELD_LIMITS.department)
  };
}

/**
 * The work mode a board wrote, `null` when it is unknown or unspecified
 *
 * @param {string | null | undefined} value
 *
 * @returns {WorkModeEnum | null}
 */
export function atsWorkMode(value: string | null | undefined): WorkModeEnum | null {
  return (value && WORK_MODES.get(value.trim().toLowerCase())) || null;
}
