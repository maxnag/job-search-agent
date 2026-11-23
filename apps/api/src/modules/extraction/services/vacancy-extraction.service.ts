import { readFile } from 'node:fs/promises';

import { Injectable } from '@nestjs/common';

import { LLMStepEnum } from '@job-agent/shared';

import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { fenceUntrusted } from '../../llm/helpers/untrusted-text.helper.js';
import type { ISchemaResult } from '../../llm/interfaces/l-l-m-client.interface.js';
import { type VacancyExtractionType, vacancyExtractionSchema } from '../schemas/vacancy-extraction.schema.js';

/**
 * Prompt of the extract step, copied next to the compiled code by the build
 *
 * @type {URL}
 */
const PROMPT_URL = new URL('../prompts/vacancy-extract.md', import.meta.url);

/**
 * Tag the page text is fenced in — the prompt names it
 *
 * @type {string}
 */
const POSTING_TAG = 'posting';

/**
 * Extracts the facts of a vacancy from the text of its page with the LLM
 */
@Injectable()
export class VacancyExtractionService {
  /**
   * @param {LLMClient} llmClient
   */
  constructor(private readonly llmClient: LLMClient) {}

  /**
   * Extract a vacancy
   *
   * @param {string} text
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<ISchemaResult<VacancyExtractionType>>}
   */
  async extract(text: string): Promise<ISchemaResult<VacancyExtractionType>> {
    return this.llmClient.generateBySchema({
      step: LLMStepEnum.EXTRACT,
      system: await readFile(PROMPT_URL, 'utf8'),
      prompt: fenceUntrusted(POSTING_TAG, text),
      schema: vacancyExtractionSchema
    });
  }
}
