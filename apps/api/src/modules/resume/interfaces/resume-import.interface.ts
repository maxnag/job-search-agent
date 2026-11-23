import type { ResumeImportStatusEnum } from '../enums/resume-import-status.enum.js';
import type { IExtractedResume } from './extracted-resume.interface.js';

/**
 * A resume file to import into a profile
 */
export interface IResumeImportRequest {
  /**
   * Absolute path of the file
   *
   * @var {string}
   */
  readonly filePath: string;

  /**
   * Profile name; created on the first import
   *
   * @var {string}
   */
  readonly profileName: string;
}

/**
 * What an import did
 */
export interface IResumeImportResult {
  /**
   * New version, the same file again, or an older version made current again
   *
   * @var {ResumeImportStatusEnum}
   */
  readonly status: ResumeImportStatusEnum;

  /**
   * Profile name
   *
   * @var {string}
   */
  readonly profileName: string;

  /**
   * Profile id
   *
   * @var {number}
   */
  readonly profileId: number;

  /**
   * Id of the current resume version
   *
   * @var {number}
   */
  readonly resumeId: number;

  /**
   * Extraction of a new version; absent when the LLM was not called
   *
   * @var {IExtractedResume}
   */
  readonly extracted?: IExtractedResume;

  /**
   * Keys of the skills hidden by the owner on the current version
   *
   * @var {readonly string[]}
   */
  readonly hiddenSkillKeys: readonly string[];
}
