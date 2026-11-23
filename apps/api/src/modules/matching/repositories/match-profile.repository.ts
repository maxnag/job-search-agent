import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { profiles, resumeSkills, resumes } from '@job-agent/db';

import { DatabaseService } from '../../database/services/database.service.js';
import type { IMatchProfile } from '../interfaces/match-profile.interface.js';

/**
 * Reads the profiles with their current resume version and its visible skills
 */
@Injectable()
export class MatchProfileRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Every profile that has a current resume version, or the one given
   *
   * @param {number} [profileId]
   *
   * @returns {Promise<IMatchProfile[]>}
   */
  async findCurrent(profileId?: number): Promise<IMatchProfile[]> {
    const { db } = this.databaseService;
    const rows = await db
      .select({
        profileId: profiles.profile_id,
        profileName: profiles.profile_name,
        preferences: profiles.profile_preferences,
        resumeId: resumes.resume_id,
        experienceYears: resumes.resume_experience_years
      })
      .from(profiles)
      .innerJoin(resumes, and(eq(resumes.profile_id, profiles.profile_id), sql`${resumes.resume_is_current}`))
      .where(profileId === undefined ? undefined : eq(profiles.profile_id, profileId));

    if (rows.length === 0) {
      return [];
    }

    const skills = await db
      .select({ resumeId: resumeSkills.resume_id, key: resumeSkills.resume_skill_key })
      .from(resumeSkills)
      .where(
        and(
          inArray(
            resumeSkills.resume_id,
            rows.map(row => row.resumeId)
          ),
          eq(resumeSkills.resume_skill_is_hidden, false)
        )
      );

    return rows.map(row => ({ ...row, skillKeys: skills.filter(skill => skill.resumeId === row.resumeId).map(skill => skill.key) }));
  }
}
