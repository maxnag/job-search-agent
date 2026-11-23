import type { IExtractedResume } from './extracted-resume.interface.js';

/**
 * A new resume version to store as the current one of its profile
 */
export interface ICreateResumeRequest {
  /**
   * Profile of the resume
   *
   * @var {number}
   */
  readonly profileId: number;

  /**
   * Original file name
   *
   * @var {string}
   */
  readonly fileName: string;

  /**
   * SHA-256 of the file
   *
   * @var {string}
   */
  readonly fileHash: string;

  /**
   * Path of the stored file, relative to `STORAGE_DIR`
   *
   * @var {string}
   */
  readonly filePath: string;

  /**
   * Text of the resume
   *
   * @var {string}
   */
  readonly text: string;

  /**
   * Extraction result
   *
   * @var {IExtractedResume}
   */
  readonly extracted: IExtractedResume;
}
