import { Injectable } from '@nestjs/common';

import { ProfileRepository } from '../../resume/repositories/profile.repository.js';
import { parseProfilePreferences } from '../../vacancies/helpers/profile-preferences.helper.js';
import type { IProfilePreferencesEntry } from '../interfaces/profile-preferences-entry.interface.js';

/**
 * Reads the preferences of every profile, validated — they are edited by hand
 */
@Injectable()
export class ProfilePreferencesService {
  /**
   * @param {ProfileRepository} profileRepository
   */
  constructor(private readonly profileRepository: ProfileRepository) {}

  /**
   * Preferences of every profile
   *
   * @throws {Error} `PROFILE_PREFERENCES_INVALID` naming the profile and the invalid fields
   *
   * @returns {Promise<IProfilePreferencesEntry[]>}
   */
  async findAll(): Promise<IProfilePreferencesEntry[]> {
    const profiles = await this.profileRepository.findAll();

    return profiles.map(profile => ({
      name: profile.profile_name,
      preferences: parseProfilePreferences(profile.profile_name, profile.profile_preferences)
    }));
  }
}
