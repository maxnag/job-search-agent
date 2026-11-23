import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';

/**
 * Keeps resume files under `STORAGE_DIR`, by profile and by content hash
 */
@Injectable()
export class ResumeStorageService {
  /**
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(private readonly configService: ConfigService<IEnv, true>) {}

  /**
   * Write a resume file to `profiles/<profile_id>/resumes/<sha256><ext>` — named by its content, so it is written
   * before the database row and the same file always lands in the same place
   *
   * @param {Buffer} content
   * @param {number} profileId
   * @param {string} fileHash
   * @param {string} extension
   *
   * @returns {Promise<string>} The path relative to `STORAGE_DIR`
   */
  async save(content: Buffer, profileId: number, fileHash: string, extension: string): Promise<string> {
    const relativePath = join('profiles', String(profileId), 'resumes', `${fileHash}${extension}`);
    const absolutePath = resolve(this.configService.get('STORAGE_DIR', { infer: true }), relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);

    return relativePath;
  }
}
