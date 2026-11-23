import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { ResumeImportStatusEnum } from '../enums/resume-import-status.enum.js';
import { type IResumeImportRequest, type IResumeImportResult } from '../interfaces/resume-import.interface.js';
import { ProfileRepository } from '../repositories/profile.repository.js';
import { ResumeRepository } from '../repositories/resume.repository.js';
import { ResumeExtractionService } from './resume-extraction.service.js';
import { ResumeParserRegistry } from './resume-parser.registry.js';
import { ResumeStorageService } from './resume-storage.service.js';

/**
 * Imports a resume file into a profile: the newest version becomes the source of truth
 */
@Injectable()
export class ResumeImportOrchestrator {
  /**
   * Logger of the service
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(ResumeImportOrchestrator.name);

  /**
   * @param {ResumeExtractionService} resumeExtractionService
   * @param {ResumeStorageService} resumeStorageService
   * @param {ResumeParserRegistry} resumeParserRegistry
   * @param {ProfileRepository} profileRepository
   * @param {ResumeRepository} resumeRepository
   */
  constructor(
    private readonly resumeExtractionService: ResumeExtractionService,
    private readonly resumeStorageService: ResumeStorageService,
    private readonly resumeParserRegistry: ResumeParserRegistry,
    private readonly profileRepository: ProfileRepository,
    private readonly resumeRepository: ResumeRepository
  ) {}

  /**
   * Import a resume: the same file again changes nothing, a file seen before becomes current again,
   * a new file is parsed, extracted by the LLM and stored as the current version
   *
   * @param {IResumeImportRequest} request
   *
   * @throws {Error} `RESUME_FORMAT_UNSUPPORTED` if no parser reads the file
   * @throws {Error} `RESUME_PDF_NO_TEXT` if the PDF is a scan
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the extraction does not match the schema
   *
   * @returns {Promise<IResumeImportResult>}
   */
  async processImport(request: IResumeImportRequest): Promise<IResumeImportResult> {
    const fileName = basename(request.filePath);
    const parser = this.resumeParserRegistry.findOne(fileName);
    const content = await readFile(request.filePath);
    const fileHash = createHash('sha256').update(content).digest('hex');
    const profile = await this.profileRepository.findOne(request.profileName);
    const known = profile ? await this.resumeRepository.findByHash(profile.profile_id, fileHash) : undefined;

    if (profile && known) {
      return this.reuseVersion(profile.profile_id, request.profileName, known.resume_id, known.resume_is_current);
    }

    const text = await parser.parse(content);
    const extracted = await this.resumeExtractionService.extract(text);
    const { profile_id: profileId } = await this.profileRepository.findOrCreate(request.profileName);
    const filePath = await this.resumeStorageService.save(content, profileId, fileHash, extname(fileName).toLowerCase());
    const { resumeId, hiddenSkillKeys } = await this.resumeRepository.createCurrent({
      profileId,
      fileName,
      fileHash,
      filePath,
      text,
      extracted
    });
    const result = {
      status: ResumeImportStatusEnum.CREATED,
      profileName: request.profileName,
      profileId,
      resumeId,
      extracted,
      hiddenSkillKeys
    };

    this.logger.log({
      message: 'Resume imported',
      profileId: result.profileId,
      resumeId: result.resumeId,
      skills: extracted.skills.length,
      languages: extracted.languages.length
    });

    return result;
  }

  /**
   * Answer an import of a file the profile already has — make it current again if it is an older version
   *
   * @param {number} profileId
   * @param {string} profileName
   * @param {number} resumeId
   * @param {boolean} isCurrent
   *
   * @returns {Promise<IResumeImportResult>}
   */
  private async reuseVersion(profileId: number, profileName: string, resumeId: number, isCurrent: boolean): Promise<IResumeImportResult> {
    if (isCurrent) {
      return { status: ResumeImportStatusEnum.UNCHANGED, profileName, profileId, resumeId, hiddenSkillKeys: [] };
    }

    const { hiddenSkillKeys } = await this.resumeRepository.setCurrent(profileId, resumeId);

    this.logger.log({ message: 'Resume version made current again', profileId, resumeId });

    return { status: ResumeImportStatusEnum.RESTORED, profileName, profileId, resumeId, hiddenSkillKeys };
  }
}
