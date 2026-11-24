import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { JobNameEnum } from '@job-agent/shared';

import type { ISourceBlockedJob } from '../interfaces/source-blocked-job.interface.js';
import type { ISourceCandidateJob } from '../interfaces/source-candidate-job.interface.js';
import type { IVacancyJob } from '../interfaces/vacancy-job.interface.js';
import type { IVacancyMatchJob } from '../interfaces/vacancy-match-job.interface.js';
import { VacancyRepository } from '../repositories/vacancy.repository.js';

/**
 * Puts the jobs one step hands to the next: extraction of vacancies and the events the owner is told about
 */
@Injectable()
export class PipelineEventsService {
  /**
   * @param {VacancyRepository} vacancyRepository
   * @param {Queue} extractQueue
   * @param {Queue} notifyQueue
   */
  constructor(
    private readonly vacancyRepository: VacancyRepository,
    @InjectQueue('extract') private readonly extractQueue: Queue,
    @InjectQueue('notify') private readonly notifyQueue: Queue
  ) {}

  /**
   * Queue the extraction of the vacancies; one already waiting is not queued twice
   *
   * @param {readonly number[]} vacancyIds
   *
   * @returns {Promise<void>}
   */
  async queueExtraction(vacancyIds: readonly number[]): Promise<void> {
    await Promise.all(
      vacancyIds.map(async vacancyId =>
        this.extractQueue.add(JobNameEnum.EXTRACT_VACANCY, { vacancyId } satisfies IVacancyJob, {
          deduplication: { id: `${JobNameEnum.EXTRACT_VACANCY}:${vacancyId}` }
        })
      )
    );
  }

  /**
   * Tell the owner about new `fit` and `almost` verdicts; a verdict already waiting is not queued twice
   *
   * @param {readonly number[]} vacancyMatchIds
   *
   * @returns {Promise<void>}
   */
  async vacanciesMatched(vacancyMatchIds: readonly number[]): Promise<void> {
    await Promise.all(
      vacancyMatchIds.map(async vacancyMatchId =>
        this.notifyQueue.add(JobNameEnum.VACANCY_MATCHED, { vacancyMatchId } satisfies IVacancyMatchJob, {
          deduplication: { id: `${JobNameEnum.VACANCY_MATCHED}:${vacancyMatchId}` }
        })
      )
    );
  }

  /**
   * Tell the owner about the closed vacancies they got a card for or pressed a button on
   *
   * @param {readonly number[]} vacancyIds
   *
   * @returns {Promise<void>}
   */
  async vacanciesClosed(vacancyIds: readonly number[]): Promise<void> {
    const notifiedIds = await this.vacancyRepository.findNotifiedIds(vacancyIds);

    await Promise.all(
      notifiedIds.map(async vacancyId => this.notifyQueue.add(JobNameEnum.VACANCY_CLOSED, { vacancyId } satisfies IVacancyJob))
    );
  }

  /**
   * Tell the owner a vacancy they heard of has changed
   *
   * @param {number} vacancyId
   *
   * @returns {Promise<void>}
   */
  async vacancyChanged(vacancyId: number): Promise<void> {
    const [notifiedId] = await this.vacancyRepository.findNotifiedIds([vacancyId]);

    if (notifiedId !== undefined) {
      await this.notifyQueue.add(JobNameEnum.VACANCY_CHANGED, { vacancyId } satisfies IVacancyJob);
    }
  }

  /**
   * Tell the owner the crawler stopped a source
   *
   * @param {number} sourceId
   *
   * @returns {Promise<void>}
   */
  async sourceBlocked(sourceId: number): Promise<void> {
    await this.notifyQueue.add(JobNameEnum.SOURCE_BLOCKED, { sourceId } satisfies ISourceBlockedJob);
  }

  /**
   * Tell the owner the mailbox refused the account — the job mail reading is off until the API starts again
   *
   * @returns {Promise<void>}
   */
  async jobMailDisabled(): Promise<void> {
    await this.notifyQueue.add(JobNameEnum.JOB_MAIL_DISABLED, {});
  }

  /**
   * Offer the owner a company board the discovery found
   *
   * @param {ISourceCandidateJob} job
   *
   * @returns {Promise<void>}
   */
  async sourceCandidateProposed(job: ISourceCandidateJob): Promise<void> {
    await this.notifyQueue.add(JobNameEnum.SOURCE_CANDIDATE, job);
  }
}
