import { type ProfilePreferencesType, profilePreferencesSchema } from '../schemas/profile-preferences.schema.js';

/**
 * Validate the preferences of a profile — they are edited by hand
 *
 * @param {string} profileName
 * @param {unknown} preferences
 *
 * @throws {Error} `PROFILE_PREFERENCES_INVALID` naming the profile and the invalid fields — the owner fixes the row
 *
 * @returns {ProfilePreferencesType}
 */
export function parseProfilePreferences(profileName: string, preferences: unknown): ProfilePreferencesType {
  const result = profilePreferencesSchema.safeParse(preferences);

  if (!result.success) {
    const fields = result.error.issues.map(issue => issue.path.join('.')).join(', ');

    throw new Error(`PROFILE_PREFERENCES_INVALID: profile ${profileName}: ${fields}`, { cause: result.error });
  }

  return result.data;
}
