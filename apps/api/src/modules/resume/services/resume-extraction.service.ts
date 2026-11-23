import { readFile } from 'node:fs/promises';

import { Injectable, Logger } from '@nestjs/common';

import { LLMStepEnum } from '@job-agent/shared';

import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { countExperienceYears, normalizeResumeLanguages, normalizeResumeSkills } from '../helpers/resume-normalization.helper.js';
import type { IExtractedResume } from '../interfaces/extracted-resume.interface.js';
import { resumeExtractionSchema } from '../schemas/resume-extraction.schema.js';

/**
 * Prompt of the extraction, copied next to the compiled code by the build
 *
 * @type {URL}
 */
const PROMPT_URL = new URL('../prompts/resume-extract.md', import.meta.url);

/**
 * Extracts skills, experience and languages from the text of a resume with the LLM
 */
@Injectable()
export class ResumeExtractionService {
  /**
   * Logger of the service
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(ResumeExtractionService.name);

  /**
   * @param {LLMClient} llmClient
   */
  constructor(private readonly llmClient: LLMClient) {}

  /**
   * Extract and normalize a resume
   *
   * @param {string} text
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<IExtractedResume>}
   */
  async extract(text: string): Promise<IExtractedResume> {
    const system = await readFile(PROMPT_URL, 'utf8');
    const { data, model } = await this.llmClient.generateBySchema({
      step: LLMStepEnum.RESUME,
      system,
      prompt: text,
      schema: resumeExtractionSchema
    });
    const now = new Date();
    const skills = normalizeResumeSkills(data, now);
    const languages = normalizeResumeLanguages(data.languages);

    this.logger.debug({ message: 'Resume extracted', model, skills: skills.length, languages: languages.length });

    return { data, model, experienceYears: countExperienceYears(data.positions, now), skills, languages };
  }
}
