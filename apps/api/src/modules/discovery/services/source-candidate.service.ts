import { Injectable, Logger } from '@nestjs/common';

import { SourceCandidateStatusEnum, SourceFetchModeEnum } from '@job-agent/shared';

import { boardURL } from '../../ats/helpers/a-t-s-board.helper.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import { SourceScanOrchestrator } from '../../search/services/source-scan.orchestrator.js';
import { SourceCandidateDecisionEnum } from '../enums/source-candidate-decision.enum.js';
import type { SourceCandidateRowType } from '../interfaces/source-candidate-row.interface.js';
import { SourceCandidateRepository } from '../repositories/source-candidate.repository.js';

/**
 * The owner's decision on a proposed board: *add* makes it an `ats` source and queues its first scan, *ignore* keeps
 * it from being offered again. A board once added stays a source — a later press changes nothing
 */
@Injectable()
export class SourceCandidateService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(SourceCandidateService.name);

  /**
   * @param {SourceScanOrchestrator} sourceScanOrchestrator
   * @param {SourceCandidateRepository} sourceCandidateRepository
   * @param {SourceRepository} sourceRepository
   */
  constructor(
    private readonly sourceScanOrchestrator: SourceScanOrchestrator,
    private readonly sourceCandidateRepository: SourceCandidateRepository,
    private readonly sourceRepository: SourceRepository
  ) {}

  /**
   * Apply a decision; `undefined` when there is no such candidate
   *
   * @param {number} sourceCandidateId
   * @param {SourceCandidateDecisionEnum} decision
   *
   * @throws {Error} `SOURCE_NOT_FOUND` if the board URL is taken but its source row is gone
   *
   * @returns {Promise<SourceCandidateStatusEnum | undefined>} The status of the candidate after the decision
   */
  async decide(sourceCandidateId: number, decision: SourceCandidateDecisionEnum): Promise<SourceCandidateStatusEnum | undefined> {
    const candidate = await this.sourceCandidateRepository.findOne(sourceCandidateId);

    if (!candidate) {
      return undefined;
    }

    if (candidate.source_candidate_status === SourceCandidateStatusEnum.ADDED) {
      return SourceCandidateStatusEnum.ADDED;
    }

    if (decision === SourceCandidateDecisionEnum.IGNORE) {
      await this.sourceCandidateRepository.markDecided(sourceCandidateId, SourceCandidateStatusEnum.IGNORED, null);
      this.logger.log({ message: 'Source candidate ignored', sourceCandidateId });

      return SourceCandidateStatusEnum.IGNORED;
    }

    const sourceId = await this.addSource(candidate);

    await this.sourceCandidateRepository.markDecided(sourceCandidateId, SourceCandidateStatusEnum.ADDED, sourceId);
    await this.sourceScanOrchestrator.queueScan(sourceId);
    this.logger.log({ message: 'Source candidate added', sourceCandidateId, sourceId });

    return SourceCandidateStatusEnum.ADDED;
  }

  /**
   * The source of the candidate's board — created, or the one that already has its URL
   *
   * @param {SourceCandidateRowType} candidate
   *
   * @throws {Error} `SOURCE_NOT_FOUND` if the URL is taken but its row is gone
   *
   * @returns {Promise<number>}
   */
  private async addSource(candidate: SourceCandidateRowType): Promise<number> {
    const url = boardURL({ kind: candidate.source_candidate_ats_kind, board: candidate.source_candidate_board });
    const created = await this.sourceRepository.create({
      source_url: url,
      source_name: candidate.source_candidate_company,
      source_fetch_mode: SourceFetchModeEnum.ATS
    });
    const source = created ?? (await this.sourceRepository.findByURL(url));

    if (!source) {
      throw new Error(`SOURCE_NOT_FOUND: ${url}`);
    }

    return source.source_id;
  }
}
