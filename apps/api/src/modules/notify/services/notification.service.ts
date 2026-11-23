import { Injectable, Logger } from '@nestjs/common';

import { VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import {
  actionKeyboard,
  formatChangedNotice,
  formatClosedNotice,
  formatMatchCard,
  formatSourceBlockedNotice
} from '../helpers/vacancy-card.helper.js';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { TelegramService } from './telegram.service.js';

/**
 * Turns the pipeline events into messages: a card per new `fit` / `almost` verdict, a notice when a vacancy the owner
 * heard of closes or changes, a warning when a source is stopped. Without Telegram nothing is sent and nothing fails —
 * the cards stay unsent and the sweep queues them once the bot is configured
 */
@Injectable()
export class NotificationService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(NotificationService.name);

  /**
   * @param {TelegramService} telegramService
   * @param {PipelineEventsService} pipelineEventsService
   * @param {NotificationRepository} notificationRepository
   */
  constructor(
    private readonly telegramService: TelegramService,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly notificationRepository: NotificationRepository
  ) {}

  /**
   * Send the card of a verdict once: one already sent, a `no_fit`, a verdict of an older resume version or of a
   * vacancy no longer open is left alone
   *
   * @param {number} vacancyMatchId
   *
   * @throws {Error} `VACANCY_MATCH_NOT_FOUND` if there is no such verdict
   * @throws {GrammyError} If Telegram refuses the message
   *
   * @returns {Promise<boolean>} True when the card was sent
   */
  async sendMatch(vacancyMatchId: number): Promise<boolean> {
    if (!this.telegramService.isConfigured) {
      return false;
    }

    const card = await this.notificationRepository.findMatchCard(vacancyMatchId);

    if (!card) {
      throw new Error(`VACANCY_MATCH_NOT_FOUND: ${vacancyMatchId}`);
    }

    const due =
      card.notifiedAt === null &&
      card.isCurrentResume &&
      card.stage === VacancyStageEnum.EXTRACTED &&
      card.verdict !== VacancyMatchVerdictEnum.NO_FIT;

    if (!due) {
      this.logger.debug({ message: 'Card not due', vacancyMatchId });

      return false;
    }

    await this.telegramService.send(formatMatchCard(card), actionKeyboard(card.vacancyId));
    await this.notificationRepository.markNotified(vacancyMatchId);
    this.logger.log({ message: 'Card sent', vacancyId: card.vacancyId, vacancyMatchId, verdict: card.verdict });

    return true;
  }

  /**
   * Tell the owner a vacancy closed
   *
   * @param {number} vacancyId
   *
   * @throws {GrammyError} If Telegram refuses the message
   *
   * @returns {Promise<boolean>} True when the message was sent
   */
  async sendClosed(vacancyId: number): Promise<boolean> {
    if (!this.telegramService.isConfigured) {
      return false;
    }

    const vacancy = await this.notificationRepository.findVacancyNotice(vacancyId);

    if (!vacancy) {
      return false;
    }

    await this.telegramService.send(formatClosedNotice(vacancy));
    this.logger.log({ message: 'Closed notice sent', vacancyId });

    return true;
  }

  /**
   * Tell the owner a vacancy changed, with its verdict now and the buttons
   *
   * @param {number} vacancyId
   *
   * @throws {GrammyError} If Telegram refuses the message
   *
   * @returns {Promise<boolean>} True when the message was sent
   */
  async sendChanged(vacancyId: number): Promise<boolean> {
    if (!this.telegramService.isConfigured) {
      return false;
    }

    const vacancy = await this.notificationRepository.findVacancyNotice(vacancyId);

    if (!vacancy) {
      return false;
    }

    await this.telegramService.send(formatChangedNotice(vacancy), actionKeyboard(vacancyId));
    this.logger.log({ message: 'Changed notice sent', vacancyId });

    return true;
  }

  /**
   * Warn the owner the crawler stopped a source
   *
   * @param {number} sourceId
   *
   * @throws {GrammyError} If Telegram refuses the message
   *
   * @returns {Promise<boolean>} True when the message was sent
   */
  async sendSourceBlocked(sourceId: number): Promise<boolean> {
    if (!this.telegramService.isConfigured) {
      return false;
    }

    const source = await this.notificationRepository.findSourceNotice(sourceId);

    if (!source) {
      return false;
    }

    await this.telegramService.send(formatSourceBlockedNotice(source));
    this.logger.log({ message: 'Source stopped notice sent', sourceId });

    return true;
  }

  /**
   * Queue the cards not sent yet — verdicts stored by a command, or before the bot was configured
   *
   * @returns {Promise<number>} The number of cards queued
   */
  async queuePending(): Promise<number> {
    if (!this.telegramService.isConfigured) {
      return 0;
    }

    const pending = await this.notificationRepository.findPendingMatchIds();

    await this.pipelineEventsService.vacanciesMatched(pending);

    if (pending.length > 0) {
      this.logger.log({ message: 'Pending cards queued', cards: pending.length });
    }

    return pending.length;
  }
}
