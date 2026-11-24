import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, type CallbackQueryContext, type Context, GrammyError, type InlineKeyboard } from 'grammy';

import { SourceCandidateStatusEnum, type VacancyActionKindEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import type { SourceCandidateDecisionEnum } from '../../discovery/enums/source-candidate-decision.enum.js';
import { SourceCandidateService } from '../../discovery/services/source-candidate.service.js';
import { CANDIDATE_DATA, candidateKeyboard } from '../helpers/source-candidate-card.helper.js';
import { ACTION_DATA, actionKeyboard } from '../helpers/vacancy-card.helper.js';
import { VacancyActionService } from './vacancy-action.service.js';

/**
 * Answer of the bot to each decision on a candidate card
 *
 * @type {ReadonlyMap<SourceCandidateStatusEnum, string>}
 */
const CANDIDATE_ANSWERS: ReadonlyMap<SourceCandidateStatusEnum, string> = new Map([
  [SourceCandidateStatusEnum.ADDED, 'Added — the first scan is queued'],
  [SourceCandidateStatusEnum.IGNORED, 'Ignored — it will not be offered again']
]);

/**
 * Description of the Telegram answer to an edit that changes nothing
 *
 * @type {string}
 */
const NOT_MODIFIED = 'message is not modified';

/**
 * Buttons of a keyboard as one comparable string: the label and the data of each, row by row
 *
 * @param {InlineKeyboard['inline_keyboard']} rows
 *
 * @returns {string}
 */
function keyboardKey(rows: InlineKeyboard['inline_keyboard']): string {
  return JSON.stringify(rows.map(row => row.map(button => [button.text, 'callback_data' in button ? button.callback_data : ''])));
}

/**
 * The owner's Telegram bot: sends the messages to `TELEGRAM_CHAT_ID` and takes the button presses over long polling —
 * no webhook, no public address. Without a token the application runs and sends nothing
 */
@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnApplicationShutdown {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(TelegramService.name);

  /**
   * The bot; undefined without a token
   *
   * @var {Bot | undefined}
   */
  private readonly bot?: Bot;

  /**
   * The owner's chat
   *
   * @var {string | undefined}
   */
  private readonly chatId?: string;

  /**
   * @param {VacancyActionService} vacancyActionService
   * @param {SourceCandidateService} sourceCandidateService
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly vacancyActionService: VacancyActionService,
    private readonly sourceCandidateService: SourceCandidateService,
    private readonly configService: ConfigService<IEnv, true>
  ) {
    const token = this.configService.get('TELEGRAM_BOT_TOKEN', { infer: true });

    this.chatId = this.configService.get('TELEGRAM_CHAT_ID', { infer: true });

    if (!token) {
      return;
    }

    this.bot = new Bot(token);
    this.bot.callbackQuery(ACTION_DATA, async context => this.onAction(context));
    this.bot.callbackQuery(CANDIDATE_DATA, async context => this.onCandidate(context));
    this.bot.catch(error => {
      this.logger.error(`Telegram update failed: ${error.message}`, error.stack);
    });
  }

  /**
   * True when the token and the chat are set
   *
   * @returns {boolean}
   */
  get isConfigured(): boolean {
    return this.bot !== undefined && this.chatId !== undefined;
  }

  /**
   * Start long polling without holding up the start of the application
   *
   * @returns {void}
   */
  onApplicationBootstrap(): void {
    if (!this.bot) {
      this.logger.warn({ message: 'Telegram is not configured, nothing will be sent' });

      return;
    }

    void this.poll(this.bot);
  }

  /**
   * Stop long polling
   *
   * @returns {Promise<void>}
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.bot?.isRunning()) {
      await this.bot.stop();
    }
  }

  /**
   * Send a message to the owner's chat
   *
   * @param {string} html Telegram HTML
   * @param {InlineKeyboard} [keyboard]
   *
   * @throws {Error} `TELEGRAM_NOT_CONFIGURED` without a token or a chat
   * @throws {GrammyError} If Telegram refuses the message
   *
   * @returns {Promise<number>} Id of the sent message
   */
  async send(html: string, keyboard?: InlineKeyboard): Promise<number> {
    if (!this.bot || !this.chatId) {
      throw new Error('TELEGRAM_NOT_CONFIGURED: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not set');
    }

    const message = await this.bot.api.sendMessage(this.chatId, html, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(keyboard ? { reply_markup: keyboard } : {})
    });

    return message.message_id;
  }

  /**
   * Poll until the bot is stopped; a failure (a wrong token) is reported, not fatal
   *
   * @param {Bot} bot
   *
   * @returns {Promise<void>}
   */
  private async poll(bot: Bot): Promise<void> {
    try {
      await bot.start({
        allowed_updates: ['callback_query'],
        onStart: info => this.logger.log({ message: 'Telegram bot started', bot: info.username })
      });
    } catch (error) {
      this.logger.error(`Telegram polling stopped: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * A button under a card was pressed: store it, tick it, confirm it. A press from another chat is ignored
   *
   * @param {CallbackQueryContext<Context>} context
   *
   * @returns {Promise<void>}
   */
  private async onAction(context: CallbackQueryContext<Context>): Promise<void> {
    const message = context.callbackQuery.message;

    if (!message || String(message.chat.id) !== this.chatId) {
      await context.answerCallbackQuery();

      return;
    }

    const [, vacancyId, kind] = ACTION_DATA.exec(context.callbackQuery.data) ?? [];
    const action = kind as VacancyActionKindEnum;

    await this.vacancyActionService.record(+(vacancyId ?? 0), action, message.message_id);
    await this.tick(context, actionKeyboard(+(vacancyId ?? 0), action));
    await context.answerCallbackQuery({ text: 'Saved' });
  }

  /**
   * A button under a candidate card was pressed: apply the decision, tick it, confirm it. A press from another chat is
   * ignored
   *
   * @param {CallbackQueryContext<Context>} context
   *
   * @returns {Promise<void>}
   */
  private async onCandidate(context: CallbackQueryContext<Context>): Promise<void> {
    const message = context.callbackQuery.message;

    if (!message || String(message.chat.id) !== this.chatId) {
      await context.answerCallbackQuery();

      return;
    }

    const [, candidateId, decision] = CANDIDATE_DATA.exec(context.callbackQuery.data) ?? [];
    const status = await this.sourceCandidateService.decide(+(candidateId ?? 0), decision as SourceCandidateDecisionEnum);

    if (!status) {
      await context.answerCallbackQuery({ text: 'This board is no longer known' });

      return;
    }

    await this.tick(context, candidateKeyboard(+(candidateId ?? 0), status));
    await context.answerCallbackQuery({ text: CANDIDATE_ANSWERS.get(status) ?? 'Saved' });
  }

  /**
   * Show the chosen button under the card. A press on the button already chosen changes nothing, so the card is left
   * as it is — Telegram refuses an edit without a change. Two quick presses can both pass the comparison; the second
   * edit is refused the same way and is only a debug line
   *
   * @param {CallbackQueryContext<Context>} context
   * @param {InlineKeyboard} keyboard
   *
   * @throws {GrammyError} If Telegram refuses the edit for another reason
   *
   * @returns {Promise<void>}
   */
  private async tick(context: CallbackQueryContext<Context>, keyboard: InlineKeyboard): Promise<void> {
    const current = context.callbackQuery.message?.reply_markup?.inline_keyboard ?? [];

    if (keyboardKey(current) === keyboardKey(keyboard.inline_keyboard)) {
      return;
    }

    try {
      await context.editMessageReplyMarkup({ reply_markup: keyboard });
    } catch (error) {
      if (error instanceof GrammyError && error.description.includes(NOT_MODIFIED)) {
        this.logger.debug({ message: 'Card buttons already shown' });

        return;
      }

      throw error;
    }
  }
}
