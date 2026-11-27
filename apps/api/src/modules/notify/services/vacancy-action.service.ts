import { Injectable, Logger } from '@nestjs/common';

import type { VacancyActionKindEnum } from '@job-agent/shared';

import { NotificationRepository } from '../repositories/notification.repository.js';

/**
 * Stores the choices the owner makes — the buttons under the cards, the web UI and the MCP tool; the filters are tuned
 * by them. Showing a choice under the Telegram messages of the vacancy is the job of the caller that has the queues
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
   * Store a choice: a press under a card carries its Telegram message, which is remembered as one that shows the
   * buttons of the vacancy; a choice made in the web UI or through the MCP server has none. A repeat of the latest
   * choice about the vacancy, from any channel, is not stored again
   *
   * @param {number} vacancyId
   * @param {VacancyActionKindEnum} kind
   * @param {number} [messageId]
   *
   * @returns {Promise<boolean>} false when the latest choice was already this one
   */
  async record(vacancyId: number, kind: VacancyActionKindEnum, messageId?: number): Promise<boolean> {
    if (messageId !== undefined) {
      await this.notificationRepository.createMessage(vacancyId, messageId);
    }

    const recorded = await this.notificationRepository.createAction(vacancyId, kind, messageId);

    if (!recorded) {
      this.logger.debug({ message: 'Vacancy action repeated', vacancyId, kind });

      return false;
    }

    this.logger.log({ message: 'Vacancy action', vacancyId, kind });

    return true;
  }
}
