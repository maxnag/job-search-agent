import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, type CallbackQueryContext, type Context, type InlineKeyboard } from 'grammy';

import type { VacancyActionKindEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { ACTION_DATA, actionKeyboard } from '../helpers/vacancy-card.helper.js';
import { VacancyActionService } from './vacancy-action.service.js';

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
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly vacancyActionService: VacancyActionService,
    private readonly configService: ConfigService<IEnv, true>
  ) {
    const token = this.configService.get('TELEGRAM_BOT_TOKEN', { infer: true });

    this.chatId = this.configService.get('TELEGRAM_CHAT_ID', { infer: true });

    if (!token) {
      return;
    }

    this.bot = new Bot(token);
    this.bot.callbackQuery(ACTION_DATA, async context => this.onAction(context));
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
    await context.editMessageReplyMarkup({ reply_markup: actionKeyboard(+(vacancyId ?? 0), action) });
    await context.answerCallbackQuery({ text: 'Saved' });
  }
}
