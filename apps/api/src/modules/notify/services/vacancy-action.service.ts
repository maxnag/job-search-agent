import { Injectable, Logger } from '@nestjs/common';

import type { VacancyActionKindEnum } from '@job-agent/shared';

import { NotificationRepository } from '../repositories/notification.repository.js';

/**
 * Stores the buttons the owner presses — the history of choices the filters are tuned by
 */
@Injectable()
export class VacancyActionService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(VacancyActionService.name);

  /**
   * @param {NotificationRepository} notificationRepository
   */
  constructor(private readonly notificationRepository: NotificationRepository) {}

  /**
   * Store a press
   *
   * @param {number} vacancyId
   * @param {VacancyActionKindEnum} kind
   * @param {number} messageId
   *
   * @returns {Promise<void>}
   */
  async record(vacancyId: number, kind: VacancyActionKindEnum, messageId: number): Promise<void> {
    await this.notificationRepository.createAction(vacancyId, kind, messageId);
    this.logger.log({ message: 'Vacancy action', vacancyId, kind });
  }
}
