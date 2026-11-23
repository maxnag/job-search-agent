import { readFile } from 'node:fs/promises';

import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMStepEnum, LanguageLevelEnum, SkillKindEnum } from '@job-agent/shared';

import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { resumeExtractionSchema } from '../schemas/resume-extraction.schema.js';
import { ResumeExtractionService } from './resume-extraction.service.js';

const PROMPT_URL = new URL('../prompts/resume-extract.md', import.meta.url);

describe('ResumeExtractionService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ResumeExtractionService;
  let llm: DeepMocked<LLMClient>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15));
    llm = createMock<LLMClient>();
    moduleFixture = await Test.createTestingModule({
      providers: [ResumeExtractionService, { provide: LLMClient, useValue: llm }]
    }).compile();

    subjectUnderTest = moduleFixture.get(ResumeExtractionService);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('asks the resume step with the prompt file and the schema, and counts the years', async () => {
    llm.generateBySchema.mockResolvedValue({
      model: 'claude-haiku-5-5',
      data: {
        positions: [
          {
            title: 'Developer',
            company: 'Fictional Ltd',
            start: '2019',
            end: '2024',
            skills: [{ name: 'TypeScript', kind: SkillKindEnum.PROGRAMMING_LANGUAGE }]
          }
        ],
        claimed_skills: [{ name: 'TypeScript', kind: SkillKindEnum.PROGRAMMING_LANGUAGE }],
        languages: [{ name: 'English', code: 'en', level: LanguageLevelEnum.FLUENT }]
      }
    });

    const extracted = await subjectUnderTest.extract('resume text');

    expect(llm.generateBySchema).toHaveBeenCalledWith({
      step: LLMStepEnum.RESUME,
      system: await readFile(PROMPT_URL, 'utf8'),
      prompt: 'resume text',
      schema: resumeExtractionSchema
    });
    expect(extracted).toMatchObject({
      model: 'claude-haiku-5-5',
      experienceYears: 6,
      languages: [{ code: 'en', level: LanguageLevelEnum.FLUENT }]
    });
    expect(extracted.skills.map(skill => skill.key)).toEqual(['typescript', 'javascript']);
  });

  it('passes on the error of the LLM', async () => {
    llm.generateBySchema.mockRejectedValue(new Error('LLM_OUTPUT_SCHEMA_INVALID: the answer is not JSON'));

    await expect(subjectUnderTest.extract('resume text')).rejects.toThrow('LLM_OUTPUT_SCHEMA_INVALID');
  });

  it('keeps the bytes of the prompt (golden snapshot)', async () => {
    expect(await readFile(PROMPT_URL, 'utf8')).toMatchSnapshot();
  });
});
