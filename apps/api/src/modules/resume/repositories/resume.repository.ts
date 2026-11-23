import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { type DatabaseExecutor, resumeLanguages, resumeSkills, resumes } from '@job-agent/db';

import { DatabaseService } from '../../database/services/database.service.js';
import type { ICreateResumeRequest } from '../interfaces/create-resume.interface.js';
import type { ICurrentResume } from '../interfaces/current-resume.interface.js';
import type { ResumeRowType } from '../interfaces/resume-row.interface.js';

/**
 * Data access of the resume versions with their skills and languages
 */
@Injectable()
export class ResumeRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Version of a profile made from the same file
   *
   * @param {number} profileId
   * @param {string} fileHash
   *
   * @returns {Promise<ResumeRowType | undefined>}
   */
  async findByHash(profileId: number, fileHash: string): Promise<ResumeRowType | undefined> {
    const [row] = await this.databaseService.db
      .select()
      .from(resumes)
      .where(and(eq(resumes.profile_id, profileId), eq(resumes.resume_file_hash, fileHash)))
      .limit(1);

    return row;
  }

  /**
   * Store a resume version with its skills and languages as the current version of its profile — one transaction
   * over the tables of the resume aggregate: the previous current version is cleared first, so the
   * one-current-per-profile index holds at every statement. Skills the owner hid on the previous current version
   * stay hidden on this one
   *
   * @param {ICreateResumeRequest} request
   *
   * @throws {Error} `RESUME_NOT_CREATED` if the resume row was not inserted
   *
   * @returns {Promise<ICurrentResume>}
   */
  async createCurrent(request: ICreateResumeRequest): Promise<ICurrentResume> {
    const { extracted } = request;

    return this.databaseService.db.transaction(async tx => {
      const hidden = await this.findHiddenKeys(tx, request.profileId);

      await this.clearCurrent(tx, request.profileId);

      const [row] = await tx
        .insert(resumes)
        .values({
          profile_id: request.profileId,
          resume_file_name: request.fileName,
          resume_file_hash: request.fileHash,
          resume_file_path: request.filePath,
          resume_text: request.text,
          resume_data: extracted.data,
          resume_experience_years: extracted.experienceYears,
          resume_llm_model: extracted.model,
          resume_is_current: true
        })
        .returning({ resumeId: resumes.resume_id });

      if (!row) {
        throw new Error(`RESUME_NOT_CREATED: profile ${request.profileId}`);
      }

      if (extracted.skills.length > 0) {
        await tx.insert(resumeSkills).values(
          extracted.skills.map(skill => ({
            resume_id: row.resumeId,
            resume_skill_key: skill.key,
            resume_skill_name: skill.name,
            resume_skill_kind: skill.kind,
            resume_skill_years: skill.years,
            resume_skill_is_unknown: skill.isUnknown,
            resume_skill_is_claimed: skill.isClaimed,
            resume_skill_is_hidden: hidden.has(skill.key)
          }))
        );
      }

      if (extracted.languages.length > 0) {
        await tx.insert(resumeLanguages).values(
          extracted.languages.map(language => ({
            resume_id: row.resumeId,
            resume_language_code: language.code,
            resume_language_level: language.level
          }))
        );
      }

      return { resumeId: row.resumeId, hiddenSkillKeys: extracted.skills.map(skill => skill.key).filter(key => hidden.has(key)) };
    });
  }

  /**
   * Make an existing version the current one of its profile, in one transaction; its hidden skills follow the
   * owner's latest choice — the hidden set of the version that was current
   *
   * @param {number} profileId
   * @param {number} resumeId
   *
   * @returns {Promise<ICurrentResume>}
   */
  async setCurrent(profileId: number, resumeId: number): Promise<ICurrentResume> {
    return this.databaseService.db.transaction(async tx => {
      const hidden = [...(await this.findHiddenKeys(tx, profileId))];

      await this.clearCurrent(tx, profileId);
      await tx.update(resumes).set({ resume_is_current: true }).where(eq(resumes.resume_id, resumeId));
      await tx
        .update(resumeSkills)
        .set({ resume_skill_is_hidden: hidden.length > 0 ? inArray(resumeSkills.resume_skill_key, hidden) : sql`false` })
        .where(eq(resumeSkills.resume_id, resumeId));

      const carried = await tx
        .select({ key: resumeSkills.resume_skill_key })
        .from(resumeSkills)
        .where(and(eq(resumeSkills.resume_id, resumeId), eq(resumeSkills.resume_skill_is_hidden, true)));

      return { resumeId, hiddenSkillKeys: carried.map(skill => skill.key) };
    });
  }

  /**
   * Keys of the skills hidden on the current version of a profile
   *
   * @param {DatabaseExecutor} tx
   * @param {number} profileId
   *
   * @returns {Promise<ReadonlySet<string>>}
   */
  private async findHiddenKeys(tx: DatabaseExecutor, profileId: number): Promise<ReadonlySet<string>> {
    const rows = await tx
      .select({ key: resumeSkills.resume_skill_key })
      .from(resumeSkills)
      .innerJoin(resumes, eq(resumes.resume_id, resumeSkills.resume_id))
      .where(and(eq(resumes.profile_id, profileId), sql`${resumes.resume_is_current}`, eq(resumeSkills.resume_skill_is_hidden, true)));

    return new Set(rows.map(row => row.key));
  }

  /**
   * Clear the current flag of a profile's versions
   *
   * @param {DatabaseExecutor} tx
   * @param {number} profileId
   *
   * @returns {Promise<void>}
   */
  private async clearCurrent(tx: DatabaseExecutor, profileId: number): Promise<void> {
    await tx
      .update(resumes)
      .set({ resume_is_current: false })
      .where(and(eq(resumes.profile_id, profileId), sql`${resumes.resume_is_current}`));
  }
}
