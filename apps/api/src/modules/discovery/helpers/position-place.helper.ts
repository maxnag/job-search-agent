import { WorkModeEnum } from '@job-agent/shared';

import type { IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';
import type { IProfilePreferencesEntry } from '../../search/interfaces/profile-preferences-entry.interface.js';
import type { IPositionPlaces } from '../interfaces/position-places.interface.js';
import { countryFromLocation } from './location-country.helper.js';

/**
 * Every work mode — a place that accepts all of them does not need to know the mode
 *
 * @type {readonly WorkModeEnum[]}
 */
const ALL_WORK_MODES: readonly WorkModeEnum[] = Object.values(WorkModeEnum);

/**
 * Split the positions of a board by whether their place is known well enough to judge
 *
 * @param {readonly IATSPosition[]} positions
 * @param {readonly IProfilePreferencesEntry[]} profiles
 *
 * @returns {IPositionPlaces}
 */
export function positionPlaces(positions: readonly IATSPosition[], profiles: readonly IProfilePreferencesEntry[]): IPositionPlaces {
  const places = profiles.flatMap(profile => profile.preferences.places);
  const countries = [...new Set(places.map(place => place.country))];
  const anyMode = new Set(
    places.filter(place => ALL_WORK_MODES.every(mode => place.work_modes.includes(mode))).map(place => place.country)
  );
  const known: IATSPosition[] = [];

  for (const position of positions) {
    const country = position.country ?? countryFromLocation(position.location, countries);
    const modeMatters = country !== null && countries.includes(country) && !anyMode.has(country);

    if (country !== null && !(modeMatters && position.workMode === null)) {
      known.push({ ...position, country });
    }
  }

  return { known, unknown: positions.length - known.length };
}
