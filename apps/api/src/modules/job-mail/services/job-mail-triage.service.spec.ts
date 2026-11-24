import { readFile } from 'node:fs/promises';

import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobMailKindEnum, LLMStepEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import type { IJobMailHeaders } from '../interfaces/job-mail-message.interface.js';
import { jobMailTriageSchema } from '../schemas/job-mail-triage.schema.js';
import { JobMailTriageService } from './job-mail-triage.service.js';

/**
 * Prompt of the step
 *
 * @type {URL}
 */
const PROMPT_URL = new URL('../prompts/job-mail-triage.md', import.meta.url);

/**
 * Headers of a fictional e-mail
 *
 * @param {number} index
 * @param {Partial<IJobMailHeaders>} changes
 *
 * @returns {IJobMailHeaders}
 */
function headers(index: number, changes: Partial<IJobMailHeaders> = {}): IJobMailHeaders {
  return {
    providerId: `1:${index}`,
    messageKey: `<mail-${index}@example.com>`,
    senderName: 'Northwind Careers',
    senderAddress: 'alerts@jobs.example.com',
    subject: `Backend Developer and ${index} more jobs`,
    receivedAt: new Date('2026-11-24T08:00:00Z'),
    ...changes
  };
}

describe('JobMailTriageService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: JobMailTriageService;
  let llm: DeepMocked<LLMClient>;

  beforeEach(async () => {
    llm = createMock<LLMClient>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        JobMailTriageService,
        { provide: LLMClient, useValue: llm },
        { provide: ConfigService, useValue: createConfigMock({ JOB_MAIL_TRIAGE_BATCH_SIZE: 2 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(JobMailTriageService);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('asks the mail step with the headers only, fenced as data, and maps the numbers back to the e-mails', async () => {
    llm.generateBySchema.mockResolvedValue({
      data: {
        mails: [
          { mail: 1, kind: JobMailKindEnum.RECRUITER },
          { mail: 0, kind: JobMailKindEnum.JOB_ALERT }
        ]
      },
      model: 'claude-haiku-5-5'
    });

    await expect(
      subjectUnderTest.classify([headers(0), headers(1, { senderName: null, senderAddress: 'Recruiter@Agency.Example.org', subject: '' })])
    ).resolves.toEqual([JobMailKindEnum.JOB_ALERT, JobMailKindEnum.RECRUITER]);

    const request = llm.generateBySchema.mock.calls[0]?.[0];

    expect(request).toMatchObject({ step: LLMStepEnum.MAIL, system: await readFile(PROMPT_URL, 'utf8'), schema: jobMailTriageSchema });
    expect(request?.prompt).toBe(
      '<mails>\n' +
        '[0] from: Northwind Careers (jobs.example.com) | subject: Backend Developer and 0 more jobs\n' +
        '[1] from: (agency.example.org) | subject: (no subject)\n' +
        '</mails>'
    );
  });

  it('asks in batches of JOB_MAIL_TRIAGE_BATCH_SIZE, numbering each batch from zero', async () => {
    llm.generateBySchema
      .mockResolvedValueOnce({
        data: {
          mails: [
            { mail: 0, kind: JobMailKindEnum.OTHER },
            { mail: 1, kind: JobMailKindEnum.OTHER }
          ]
        },
        model: 'm'
      })
      .mockResolvedValueOnce({ data: { mails: [{ mail: 0, kind: JobMailKindEnum.RECRUITER }] }, model: 'm' });

    await expect(subjectUnderTest.classify([headers(0), headers(1), headers(2)])).resolves.toEqual([
      JobMailKindEnum.OTHER,
      JobMailKindEnum.OTHER,
      JobMailKindEnum.RECRUITER
    ]);
    expect(llm.generateBySchema).toHaveBeenCalledTimes(2);
    expect(llm.generateBySchema.mock.calls[1]?.[0].prompt).toMatch(/^<mails>\n\[0\] from: Northwind Careers/);
  });

  it('reads an e-mail the answer left out as a job alert, and ignores a number out of range or repeated', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    llm.generateBySchema.mockResolvedValue({
      data: {
        mails: [
          { mail: 0, kind: JobMailKindEnum.OTHER },
          { mail: 0, kind: JobMailKindEnum.RECRUITER },
          { mail: 5, kind: JobMailKindEnum.OTHER }
        ]
      },
      model: 'm'
    });

    await expect(subjectUnderTest.classify([headers(0), headers(1)])).resolves.toEqual([JobMailKindEnum.OTHER, JobMailKindEnum.JOB_ALERT]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Job mail answer left e-mails out, read as job alerts', unanswered: 1 })
    );
  });

  it('clips a long sender name and subject', async () => {
    llm.generateBySchema.mockResolvedValue({ data: { mails: [{ mail: 0, kind: JobMailKindEnum.OTHER }] }, model: 'm' });

    await subjectUnderTest.classify([headers(0, { senderName: 'N'.repeat(200), subject: 'S'.repeat(1000) })]);

    const prompt = llm.generateBySchema.mock.calls[0]?.[0].prompt ?? '';

    expect(prompt).not.toContain('N'.repeat(81));
    expect(prompt).not.toContain('S'.repeat(301));
  });

  it('asks nothing for no e-mails', async () => {
    await expect(subjectUnderTest.classify([])).resolves.toEqual([]);
    expect(llm.generateBySchema).not.toHaveBeenCalled();
  });

  it('passes an LLM failure on', async () => {
    llm.generateBySchema.mockRejectedValue(new Error('LLM_OUTPUT_SCHEMA_INVALID: mails'));

    await expect(subjectUnderTest.classify([headers(0)])).rejects.toThrow('LLM_OUTPUT_SCHEMA_INVALID');
  });

  it('keeps the bytes of the prompt (golden snapshot)', async () => {
    expect(await readFile(PROMPT_URL, 'utf8')).toMatchSnapshot();
  });
});
