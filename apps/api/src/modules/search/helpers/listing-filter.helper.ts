import { screenPosition } from '../../matching/helpers/vacancy-match.helper.js';
import type { IListedPosition } from '../interfaces/listed-position.interface.js';
import type { IProfilePreferencesEntry } from '../interfaces/profile-preferences-entry.interface.js';

/**
 * Why no profile searches for the position, or undefined when at least one does: the company, role, level and place
 * rules of the matching code, applied to the listing line. A field the listing does not know never drops a position.
 * The reasons of every profile are named, so the owner sees why a position was dropped
 *
 * @param {IListedPosition} position
 * @param {readonly IProfilePreferencesEntry[]} profiles
 *
 * @returns {string | undefined}
 */
export function listingSkipReason(position: IListedPosition, profiles: readonly IProfilePreferencesEntry[]): string | undefined {
  if (profiles.length === 0) {
    return 'no profile to search for';
  }

  const reasons: string[] = [];

  for (const profile of profiles) {
    const [reason] = screenPosition(position, profile.preferences);

    if (!reason) {
      return undefined;
    }

    reasons.push(profiles.length > 1 ? `${profile.name}: ${reason.message}` : reason.message);
  }

  return reasons.join('; ');
}
