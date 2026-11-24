import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Bot, InlineKeyboard } from 'grammy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VacancyActionKindEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { SourceCandidateService } from '../../discovery/services/source-candidate.service.js';
import { TelegramService } from './telegram.service.js';
import { VacancyActionService } from './vacancy-action.service.js';

vi.mock('grammy', async importOriginal => {
  const actual = await importOriginal<typeof import('grammy')>();

  return {
    ...actual,
    Bot: vi.fn().mockImplementation(function (this: Record<string, unknown>, token: string) {
      this.token = token;
      this.callbackQuery = vi.fn();
      this.catch = vi.fn();
      this.start = vi.fn().mockResolvedValue(undefined);
      this.stop = vi.fn().mockResolvedValue(undefined);
      this.isRunning = vi.fn().mockReturnValue(true);
      this.api = { sendMessage: vi.fn().mockResolvedValue({ message_id: 555 }) };
    })
  };
});

const CHAT_ID = '-1001234567890';

/**
 * The parts of a grammY bot the service uses
 */
interface IFakeBot {
  readonly callbackQuery: ReturnType<typeof vi.fn>;
  readonly catch: ReturnType<typeof vi.fn>;
  readonly start: ReturnType<typeof vi.fn>;
  readonly stop: ReturnType<typeof vi.fn>;
  readonly isRunning: ReturnType<typeof vi.fn>;
  readonly api: { readonly sendMessage: ReturnType<typeof vi.fn> };
}

describe('TelegramService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: TelegramService;
  let actions: DeepMocked<VacancyActionService>;

  /**
   * Build the service with the given Telegram settings
   *
   * @param {Record<string, string | undefined>} env
   *
   * @returns {Promise<void>}
   */
  async function compile(env: Record<string, string | undefined>): Promise<void> {
    moduleFixture = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: VacancyActionService, useValue: actions },
        { provide: SourceCandidateService, useValue: {} },
        { provide: ConfigService, useValue: createConfigMock(env) }
      ]
    }).compile();
    subjectUnderTest = moduleFixture.get(TelegramService);
  }

  /**
   * The bot the service created
   *
   * @returns {IFakeBot}
   */
  function bot(): IFakeBot {
    return vi.mocked(Bot).mock.instances.at(-1) as unknown as IFakeBot;
  }

  beforeEach(async () => {
    vi.mocked(Bot).mockClear();
    actions = createMock<VacancyActionService>();
    await compile({ TELEGRAM_BOT_TOKEN: '123456:fictional-token', TELEGRAM_CHAT_ID: CHAT_ID });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('is configured with a token and a chat, listening to the action buttons', () => {
    expect(subjectUnderTest.isConfigured).toBe(true);
    expect(Bot).toHaveBeenCalledWith('123456:fictional-token');
    expect(bot().callbackQuery).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
  });

  it('is not configured without a chat', async () => {
    await moduleFixture.close();
    await compile({ TELEGRAM_BOT_TOKEN: '123456:fictional-token' });

    expect(subjectUnderTest.isConfigured).toBe(false);
  });

  describe('without a token', () => {
    beforeEach(async () => {
      await moduleFixture.close();
      vi.mocked(Bot).mockClear();
      await compile({});
    });

    it('creates no bot and is not configured', () => {
      expect(Bot).not.toHaveBeenCalled();
      expect(subjectUnderTest.isConfigured).toBe(false);
    });

    it('warns at start instead of polling', () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      subjectUnderTest.onApplicationBootstrap();

      expect(warn).toHaveBeenCalledWith({ message: 'Telegram is not configured, nothing will be sent' });
    });

    it('refuses to send', async () => {
      await expect(subjectUnderTest.send('<b>x</b>')).rejects.toThrow(/^TELEGRAM_NOT_CONFIGURED:/);
    });

    it('has nothing to stop', async () => {
      await expect(subjectUnderTest.onApplicationShutdown()).resolves.toBeUndefined();
    });
  });

  describe('send', () => {
    it('sends HTML to the chat without link previews and returns the message id', async () => {
      await expect(subjectUnderTest.send('<b>Backend Developer</b>')).resolves.toBe(555);
      expect(bot().api.sendMessage).toHaveBeenCalledWith(CHAT_ID, '<b>Backend Developer</b>', {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true }
      });
    });

    it('adds the buttons when given', async () => {
      const keyboard = new InlineKeyboard().text('Skip', 'action:7:skipped');

      await subjectUnderTest.send('card', keyboard);

      expect(bot().api.sendMessage).toHaveBeenCalledWith(CHAT_ID, 'card', expect.objectContaining({ reply_markup: keyboard }));
    });
  });

  describe('polling', () => {
    it('starts long polling for button presses only', () => {
      subjectUnderTest.onApplicationBootstrap();

      expect(bot().start).toHaveBeenCalledWith({ allowed_updates: ['callback_query'], onStart: expect.any(Function) as () => void });
    });

    it('logs a polling that stopped instead of crashing the app', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      bot().start.mockRejectedValue(new Error('409: Conflict: terminated by other getUpdates request'));
      subjectUnderTest.onApplicationBootstrap();

      await vi.waitFor(() => {
        expect(error).toHaveBeenCalledWith(
          'Telegram polling stopped: 409: Conflict: terminated by other getUpdates request',
          expect.any(String)
        );
      });
    });

    it('logs an update that failed', () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const onError = bot().catch.mock.calls[0]?.[0] as (error: Error) => void;

      onError(new Error('handler failed'));

      expect(error).toHaveBeenCalledWith('Telegram update failed: handler failed', expect.any(String));
    });

    it('stops a running bot on shutdown and leaves a stopped one alone', async () => {
      await subjectUnderTest.onApplicationShutdown();
      expect(bot().stop).toHaveBeenCalledTimes(1);

      bot().isRunning.mockReturnValue(false);
      await subjectUnderTest.onApplicationShutdown();
      expect(bot().stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('a button press', () => {
    /**
     * Press a button in a chat
     *
     * @param {number | undefined} chatId
     * @param {string} data
     *
     * @returns {Promise<{ answerCallbackQuery: ReturnType<typeof vi.fn>; editMessageReplyMarkup: ReturnType<typeof vi.fn> }>}
     */
    async function press(
      chatId: number | undefined,
      data: string
    ): Promise<{ answerCallbackQuery: ReturnType<typeof vi.fn>; editMessageReplyMarkup: ReturnType<typeof vi.fn> }> {
      const context = {
        callbackQuery: { data, message: chatId === undefined ? undefined : { message_id: 555, chat: { id: chatId } } },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageReplyMarkup: vi.fn().mockResolvedValue(true)
      };
      const handler = bot().callbackQuery.mock.calls[0]?.[1] as (context: unknown) => Promise<void>;

      await handler(context);

      return context;
    }

    it('records the action, ticks the button and confirms', async () => {
      const context = await press(-1001234567890, 'action:7:interested');

      expect(actions.record).toHaveBeenCalledWith(7, VacancyActionKindEnum.INTERESTED, 555);

      const markup = context.editMessageReplyMarkup.mock.calls[0]?.[0] as { reply_markup: InlineKeyboard };

      expect(markup.reply_markup.inline_keyboard.flat().map(button => button.text)).toEqual(['✓ Interested', 'Skip', 'Applied']);
      expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Saved' });
    });

    it('ignores a press from another chat', async () => {
      const context = await press(42, 'action:7:interested');

      expect(actions.record).not.toHaveBeenCalled();
      expect(context.editMessageReplyMarkup).not.toHaveBeenCalled();
      expect(context.answerCallbackQuery).toHaveBeenCalledWith();
    });

    it('ignores a press on a message Telegram no longer has', async () => {
      await press(undefined, 'action:7:interested');

      expect(actions.record).not.toHaveBeenCalled();
    });
  });
});
