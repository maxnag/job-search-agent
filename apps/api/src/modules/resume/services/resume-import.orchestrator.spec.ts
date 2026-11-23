import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ResumeImportStatusEnum } from '../enums/resume-import-status.enum.js';
import type { IExtractedResume } from '../interfaces/extracted-resume.interface.js';
import type { ProfileRowType } from '../interfaces/profile-row.interface.js';
import type { IResumeParser } from '../interfaces/resume-parser.interface.js';
import type { ResumeRowType } from '../interfaces/resume-row.interface.js';
import { ProfileRepository } from '../repositories/profile.repository.js';
import { ResumeRepository } from '../repositories/resume.repository.js';
import { ResumeExtractionService } from './resume-extraction.service.js';
import { ResumeImportOrchestrator } from './resume-import.orchestrator.js';
import { ResumeParserRegistry } from './resume-parser.registry.js';
import { ResumeStorageService } from './resume-storage.service.js';

const CONTENT = 'fictional resume of a developer';
const HASH = createHash('sha256').update(CONTENT).digest('hex');
const PROFILE = { profile_id: 3, profile_name: 'developer' } as ProfileRowType;
const EXTRACTED = {
  data: { positions: [], claimed_skills: [], languages: [] },
  model: 'm',
  experienceYears: 5,
  skills: [],
  languages: []
} as IExtractedResume;

describe('ResumeImportOrchestrator (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ResumeImportOrchestrator;
  let extraction: DeepMocked<ResumeExtractionService>;
  let storage: DeepMocked<ResumeStorageService>;
  let profiles: DeepMocked<ProfileRepository>;
  let resumes: DeepMocked<ResumeRepository>;
  let parser: IResumeParser;
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'resume-import-'));
    filePath = join(directory, 'cv.pdf');
    await writeFile(filePath, CONTENT);
    parser = { extensions: ['.pdf'], parse: () => Promise.resolve('resume text') };
    extraction = createMock<ResumeExtractionService>();
    storage = createMock<ResumeStorageService>();
    profiles = createMock<ProfileRepository>();
    resumes = createMock<ResumeRepository>();
    extraction.extract.mockResolvedValue(EXTRACTED);
    storage.save.mockResolvedValue(`profiles/3/resumes/${HASH}.pdf`);
    profiles.findOrCreate.mockResolvedValue(PROFILE);
    resumes.createCurrent.mockResolvedValue({ resumeId: 9, hiddenSkillKeys: ['java'] });
    moduleFixture = await Test.createTestingModule({
      providers: [
        ResumeImportOrchestrator,
        { provide: ResumeExtractionService, useValue: extraction },
        { provide: ResumeStorageService, useValue: storage },
        { provide: ResumeParserRegistry, useValue: new ResumeParserRegistry([parser]) },
        { provide: ProfileRepository, useValue: profiles },
        { provide: ResumeRepository, useValue: resumes }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(ResumeImportOrchestrator);
  });

  afterEach(async () => {
    await moduleFixture.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('stores a new file as the current version: parse, extract, save by hash, write', async () => {
    profiles.findOne.mockResolvedValue(undefined);

    await expect(subjectUnderTest.processImport({ filePath, profileName: 'developer' })).resolves.toEqual({
      status: ResumeImportStatusEnum.CREATED,
      profileName: 'developer',
      profileId: 3,
      resumeId: 9,
      extracted: EXTRACTED,
      hiddenSkillKeys: ['java']
    });
    expect(extraction.extract).toHaveBeenCalledWith('resume text');
    expect(storage.save).toHaveBeenCalledWith(Buffer.from(CONTENT), 3, HASH, '.pdf');
    expect(resumes.createCurrent).toHaveBeenCalledWith({
      profileId: 3,
      fileName: 'cv.pdf',
      fileHash: HASH,
      filePath: `profiles/3/resumes/${HASH}.pdf`,
      text: 'resume text',
      extracted: EXTRACTED
    });
  });

  it('changes nothing and calls no LLM for the current file again', async () => {
    profiles.findOne.mockResolvedValue(PROFILE);
    resumes.findByHash.mockResolvedValue({ resume_id: 4, resume_is_current: true } as ResumeRowType);

    await expect(subjectUnderTest.processImport({ filePath, profileName: 'developer' })).resolves.toMatchObject({
      status: ResumeImportStatusEnum.UNCHANGED,
      resumeId: 4
    });
    expect(extraction.extract).not.toHaveBeenCalled();
    expect(resumes.setCurrent).not.toHaveBeenCalled();
  });

  it('makes an older version current again without the LLM', async () => {
    profiles.findOne.mockResolvedValue(PROFILE);
    resumes.findByHash.mockResolvedValue({ resume_id: 4, resume_is_current: false } as ResumeRowType);
    resumes.setCurrent.mockResolvedValue({ resumeId: 4, hiddenSkillKeys: ['cpp'] });

    await expect(subjectUnderTest.processImport({ filePath, profileName: 'developer' })).resolves.toMatchObject({
      status: ResumeImportStatusEnum.RESTORED,
      resumeId: 4,
      hiddenSkillKeys: ['cpp']
    });
    expect(resumes.setCurrent).toHaveBeenCalledWith(3, 4);
    expect(extraction.extract).not.toHaveBeenCalled();
  });

  it('refuses an unsupported format before reading the file', async () => {
    await expect(subjectUnderTest.processImport({ filePath: join(directory, 'cv.docx'), profileName: 'developer' })).rejects.toThrow(
      'RESUME_FORMAT_UNSUPPORTED'
    );
    expect(extraction.extract).not.toHaveBeenCalled();
  });

  it('stores nothing when the extraction fails', async () => {
    profiles.findOne.mockResolvedValue(undefined);
    extraction.extract.mockRejectedValue(new Error('LLM_OUTPUT_TRUNCATED'));

    await expect(subjectUnderTest.processImport({ filePath, profileName: 'developer' })).rejects.toThrow('LLM_OUTPUT_TRUNCATED');
    expect(storage.save).not.toHaveBeenCalled();
    expect(resumes.createCurrent).not.toHaveBeenCalled();
  });
});
