import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ATSKindEnum, SourceCandidateStatusEnum, SourceFetchModeEnum } from '@job-agent/shared';

import type { SourceRowType } from '../../search/interfaces/source-row.interface.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import { SourceScanOrchestrator } from '../../search/services/source-scan.orchestrator.js';
import { SourceCandidateDecisionEnum } from '../enums/source-candidate-decision.enum.js';
import type { SourceCandidateRowType } from '../interfaces/source-candidate-row.interface.js';
import { SourceCandidateRepository } from '../repositories/source-candidate.repository.js';
import { SourceCandidateService } from './source-candidate.service.js';

const BOARD_URL = 'https://job-boards.greenhouse.io/northwind';

const CANDIDATE = {
  source_candidate_id: 5,
  source_candidate_ats_kind: ATSKindEnum.GREENHOUSE,
  source_candidate_board: 'northwind',
  source_candidate_company: 'Northwind',
  source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
  source_id: null
} as SourceCandidateRowType;

const SOURCE = { source_id: 31, source_url: BOARD_URL } as SourceRowType;

describe('SourceCandidateService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: SourceCandidateService;
  let scans: DeepMocked<SourceScanOrchestrator>;
  let candidates: DeepMocked<SourceCandidateRepository>;
  let sources: DeepMocked<SourceRepository>;

  beforeEach(async () => {
    scans = createMock<SourceScanOrchestrator>();
    candidates = createMock<SourceCandidateRepository>();
    sources = createMock<SourceRepository>();
    candidates.findOne.mockResolvedValue(CANDIDATE);
    sources.create.mockResolvedValue(SOURCE);
    moduleFixture = await Test.createTestingModule({
      providers: [
        SourceCandidateService,
        { provide: SourceScanOrchestrator, useValue: scans },
        { provide: SourceCandidateRepository, useValue: candidates },
        { provide: SourceRepository, useValue: sources }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(SourceCandidateService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('decide', () => {
    it('adds the board as an ATS source by its canonical link and queues its first scan', async () => {
      await expect(subjectUnderTest.decide(5, SourceCandidateDecisionEnum.ADD)).resolves.toBe(SourceCandidateStatusEnum.ADDED);

      expect(sources.create).toHaveBeenCalledWith({
        source_url: BOARD_URL,
        source_name: 'Northwind',
        source_fetch_mode: SourceFetchModeEnum.ATS
      });
      expect(candidates.markDecided).toHaveBeenCalledWith(5, SourceCandidateStatusEnum.ADDED, 31);
      expect(scans.queueScan).toHaveBeenCalledWith(31);
    });

    it('links the source that already has the board link', async () => {
      sources.create.mockResolvedValue(undefined);
      sources.findByURL.mockResolvedValue({ ...SOURCE, source_id: 12 });

      await subjectUnderTest.decide(5, SourceCandidateDecisionEnum.ADD);

      expect(sources.findByURL).toHaveBeenCalledWith(BOARD_URL);
      expect(candidates.markDecided).toHaveBeenCalledWith(5, SourceCandidateStatusEnum.ADDED, 12);
      expect(scans.queueScan).toHaveBeenCalledWith(12);
    });

    it('throws SOURCE_NOT_FOUND when the source neither is created nor exists, and marks nothing', async () => {
      sources.create.mockResolvedValue(undefined);
      sources.findByURL.mockResolvedValue(undefined);

      await expect(subjectUnderTest.decide(5, SourceCandidateDecisionEnum.ADD)).rejects.toThrow(`SOURCE_NOT_FOUND: ${BOARD_URL}`);
      expect(candidates.markDecided).not.toHaveBeenCalled();
      expect(scans.queueScan).not.toHaveBeenCalled();
    });

    it('ignores the board without a source', async () => {
      await expect(subjectUnderTest.decide(5, SourceCandidateDecisionEnum.IGNORE)).resolves.toBe(SourceCandidateStatusEnum.IGNORED);

      expect(candidates.markDecided).toHaveBeenCalledWith(5, SourceCandidateStatusEnum.IGNORED, null);
      expect(sources.create).not.toHaveBeenCalled();
      expect(scans.queueScan).not.toHaveBeenCalled();
    });

    it('lets an ignored board be added after all', async () => {
      candidates.findOne.mockResolvedValue({ ...CANDIDATE, source_candidate_status: SourceCandidateStatusEnum.IGNORED });

      await expect(subjectUnderTest.decide(5, SourceCandidateDecisionEnum.ADD)).resolves.toBe(SourceCandidateStatusEnum.ADDED);
      expect(scans.queueScan).toHaveBeenCalledWith(31);
    });

    it.each([SourceCandidateDecisionEnum.ADD, SourceCandidateDecisionEnum.IGNORE])(
      'keeps an added board added and changes nothing on %s',
      async decision => {
        candidates.findOne.mockResolvedValue({ ...CANDIDATE, source_candidate_status: SourceCandidateStatusEnum.ADDED, source_id: 31 });

        await expect(subjectUnderTest.decide(5, decision)).resolves.toBe(SourceCandidateStatusEnum.ADDED);
        expect(candidates.markDecided).not.toHaveBeenCalled();
        expect(sources.create).not.toHaveBeenCalled();
        expect(scans.queueScan).not.toHaveBeenCalled();
      }
    );

    it('gives undefined for a candidate that is no longer known', async () => {
      candidates.findOne.mockResolvedValue(undefined);

      await expect(subjectUnderTest.decide(99, SourceCandidateDecisionEnum.ADD)).resolves.toBeUndefined();
      expect(candidates.markDecided).not.toHaveBeenCalled();
    });
  });
});
