import type { ProfilePreferencesType } from '../../vacancies/schemas/profile-preferences.schema.js';

/**
 * A profile's name and its validated preferences
 */
export interface IProfilePreferencesEntry {
  /**
   * Name of the profile — names it in a skip reason
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Validated preferences
   *
   * @var {ProfilePreferencesType}
   */
  readonly preferences: ProfilePreferencesType;
}
