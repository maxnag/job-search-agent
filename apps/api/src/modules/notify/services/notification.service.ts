import { Injectable, Logger } from '@nestjs/common';

import { SourceCandidateStatusEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { SourceCandidateRepository } from '../../discovery/repositories/source-candidate.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { candidateKeyboard, formatSourceCandidateCard } from '../helpers/source-candidate-card.helper.js';
import {
  actionKeyboard,
  formatChangedNotice,
  formatClosedNotice,
  formatJobMailDisabledNotice,
  formatMatchCard,
  formatSourceBlockedNotice
} from '../helpers/vacancy-card.helper.js';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { TelegramService } from './telegram.service.js';

/**
 * Turns the pipeline events into messages: a card per new `fit` / `almost` verdict, a notice when a vacancy the owner
 * heard of closes or changes, a warning when a source is stopped, a card per company board the discovery proposes.
 * Without Telegram nothing is sent and nothing fails — the cards stay unsent and the sweep queues them once the bot is
 * configured
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
   * @param {SourceCandidateRepository} sourceCandidateRepository
   */
  constructor(
    private readonly telegramService: TelegramService,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly notificationRepository: NotificationRepository,
    private readonly sourceCandidateRepository: SourceCandidateRepository
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

    const messageId = await this.telegramService.send(formatMatchCard(card), actionKeyboard(card.vacancyId));

    await this.notificationRepository.createMessage(card.vacancyId, messageId);
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

    const messageId = await this.telegramService.send(formatChangedNotice(vacancy), actionKeyboard(vacancyId));

    await this.notificationRepository.createMessage(vacancyId, messageId);
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
   * Warn the owner the job mail reading is off: the mailbox refused the account or its app password
   *
   * @throws {GrammyError} If Telegram refuses the message
   *
   * @returns {Promise<boolean>} True when the message was sent
   */
  async sendJobMailDisabled(): Promise<boolean> {
    if (!this.telegramService.isConfigured) {
      return false;
    }

    await this.telegramService.send(formatJobMailDisabledNotice());
    this.logger.log({ message: 'Job mail off notice sent' });

    return true;
  }

  /**
   * Offer the owner a company board the discovery found; a candidate decided meanwhile is left alone
   *
   * @param {number} sourceCandidateId
   *
   * @throws {GrammyError} If Telegram refuses the message
   *
   * @returns {Promise<boolean>} True when the card was sent
   */
  async sendSourceCandidate(sourceCandidateId: number): Promise<boolean> {
    if (!this.telegramService.isConfigured) {
      return false;
    }

    const candidate = await this.sourceCandidateRepository.findOne(sourceCandidateId);

    if (candidate?.source_candidate_status !== SourceCandidateStatusEnum.PROPOSED) {
      return false;
    }

    await this.telegramService.send(formatSourceCandidateCard(candidate), candidateKeyboard(candidate.source_candidate_id));
    this.logger.log({ message: 'Source candidate card sent', sourceCandidateId: candidate.source_candidate_id });

    return true;
  }

  /**
   * Queue the cards not sent yet — verdicts stored by a command, or before the bot was configured — and show the
   * choices not shown yet under the messages of their vacancies: a choice made through the MCP server, or a sync
   * Telegram refused
   *
   * @throws {GrammyError} If Telegram refuses an edit for a reason other than a message it no longer has
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

    await this.syncActions();

    return pending.length;
  }

  /**
   * Show the latest choice about each vacancy with a choice not shown yet under every Telegram message of the
   * vacancy; a message the chat no longer has is forgotten. Without Telegram nothing is synced and the choices wait
   *
   * @param {number} [vacancyId] Only this vacancy
   *
   * @throws {GrammyError} If Telegram refuses an edit for a reason other than a message it no longer has
   *
   * @returns {Promise<number>} The number of vacancies synced
   */
  async syncActions(vacancyId?: number): Promise<number> {
    if (!this.telegramService.isConfigured) {
      return 0;
    }

    const actions = await this.notificationRepository.findUnsyncedActions(vacancyId);

    for (const action of actions) {
      const messageIds = await this.notificationRepository.findMessageIds(action.vacancyId);

      for (const messageId of messageIds) {
        const shown = await this.telegramService.editKeyboard(messageId, actionKeyboard(action.vacancyId, action.kind));

        if (!shown) {
          await this.notificationRepository.deleteMessage(action.vacancyId, messageId);
          this.logger.debug({ message: 'Vacancy message gone', vacancyId: action.vacancyId, messageId });
        }
      }

      await this.notificationRepository.markActionsSynced(action.vacancyId, action.vacancyActionId);
      this.logger.debug({ message: 'Vacancy action synced', vacancyId: action.vacancyId, kind: action.kind, messages: messageIds.length });
    }

    if (actions.length > 0) {
      this.logger.log({ message: 'Vacancy actions synced', vacancies: actions.length });
    }

    return actions.length;
  }
}
