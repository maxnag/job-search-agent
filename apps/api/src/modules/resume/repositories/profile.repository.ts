import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import { profiles } from '@job-agent/db';

import { DatabaseService } from '../../database/services/database.service.js';
import type { ProfileRowType } from '../interfaces/profile-row.interface.js';

/**
 * Data access of the search profiles
 */
@Injectable()
export class ProfileRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Profile by its name
   *
   * @param {string} name
   *
   * @returns {Promise<ProfileRowType | undefined>}
   */
  async findOne(name: string): Promise<ProfileRowType | undefined> {
    const [row] = await this.databaseService.db.select().from(profiles).where(eq(profiles.profile_name, name)).limit(1);

    return row;
  }

  /**
   * Every profile
   *
   * @returns {Promise<ProfileRowType[]>}
   */
  async findAll(): Promise<ProfileRowType[]> {
    return this.databaseService.db.select().from(profiles).orderBy(asc(profiles.profile_id));
  }

  /**
   * Profile by its name, created with the default core skill kinds on first use
   *
   * @param {string} name
   *
   * @throws {Error} `PROFILE_NOT_CREATED` if the profile can be neither created nor found
   *
   * @returns {Promise<ProfileRowType>}
   */
  async findOrCreate(name: string): Promise<ProfileRowType> {
    const [created] = await this.databaseService.db
      .insert(profiles)
      .values({ profile_name: name })
      .onConflictDoNothing({ target: profiles.profile_name })
      .returning();
    const profile = created ?? (await this.findOne(name));

    if (!profile) {
      throw new Error(`PROFILE_NOT_CREATED: ${name}`);
    }

    return profile;
  }
}
