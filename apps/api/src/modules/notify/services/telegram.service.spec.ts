import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Bot, GrammyError, InlineKeyboard } from 'grammy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceCandidateStatusEnum, VacancyActionKindEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { SourceCandidateDecisionEnum } from '../../discovery/enums/source-candidate-decision.enum.js';
import { SourceCandidateService } from '../../discovery/services/source-candidate.service.js';
import { candidateKeyboard } from '../helpers/source-candidate-card.helper.js';
import { actionKeyboard } from '../helpers/vacancy-card.helper.js';
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
  let candidates: DeepMocked<SourceCandidateService>;

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
        { provide: SourceCandidateService, useValue: candidates },
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
    candidates = createMock<SourceCandidateService>();
    await compile({ TELEGRAM_BOT_TOKEN: '123456:fictional-token', TELEGRAM_CHAT_ID: CHAT_ID });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('is configured with a token and a chat, listening to the vacancy and the candidate buttons', () => {
    expect(subjectUnderTest.isConfigured).toBe(true);
    expect(Bot).toHaveBeenCalledWith('123456:fictional-token');
    expect(bot().callbackQuery).toHaveBeenCalledTimes(2);
    expect((bot().callbackQuery.mock.calls[0]?.[0] as RegExp).test('action:7:interested')).toBe(true);
    expect((bot().callbackQuery.mock.calls[1]?.[0] as RegExp).test('candidate:5:add')).toBe(true);
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
     * A pressed button: the chat, the data, the buttons under the card now and how Telegram answers the edit
     */
    interface IPress {
      readonly chatId?: number;
      readonly data: string;
      readonly current?: InlineKeyboard;
      readonly editError?: Error;
    }

    /**
     * The context grammY gives a handler
     */
    interface IFakeContext {
      readonly answerCallbackQuery: ReturnType<typeof vi.fn>;
      readonly editMessageReplyMarkup: ReturnType<typeof vi.fn>;
    }

    /**
     * Press a button under a card
     *
     * @param {IPress} press
     *
     * @returns {Promise<IFakeContext>}
     */
    async function pressButton(press: IPress): Promise<IFakeContext> {
      const message =
        press.chatId === undefined
          ? undefined
          : {
              message_id: 555,
              chat: { id: press.chatId },
              ...(press.current ? { reply_markup: { inline_keyboard: press.current.inline_keyboard } } : {})
            };
      const context = {
        callbackQuery: { data: press.data, message },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageReplyMarkup: press.editError ? vi.fn().mockRejectedValue(press.editError) : vi.fn().mockResolvedValue(true)
      };
      const index = press.data.startsWith('candidate:') ? 1 : 0;
      const handler = bot().callbackQuery.mock.calls[index]?.[1] as (context: unknown) => Promise<void>;

      await handler(context);

      return context;
    }

    /**
     * Press a vacancy button in a chat
     *
     * @param {number | undefined} chatId
     * @param {string} data
     *
     * @returns {Promise<IFakeContext>}
     */
    async function press(chatId: number | undefined, data: string): Promise<IFakeContext> {
      return pressButton({ ...(chatId === undefined ? {} : { chatId }), data });
    }

    /**
     * Labels of the buttons an edit put under the card
     *
     * @param {IFakeContext} context
     *
     * @returns {string[]}
     */
    function editedLabels(context: IFakeContext): string[] {
      const markup = context.editMessageReplyMarkup.mock.calls[0]?.[0] as { reply_markup: InlineKeyboard };

      return markup.reply_markup.inline_keyboard.flat().map(button => button.text);
    }

    /**
     * The error Telegram answers an edit with
     *
     * @param {string} description
     *
     * @returns {GrammyError}
     */
    function telegramError(description: string): GrammyError {
      return new GrammyError(
        "Call to 'editMessageReplyMarkup' failed!",
        { ok: false, error_code: 400, description },
        'editMessageReplyMarkup',
        {}
      );
    }

    it('records the action, ticks the button and confirms', async () => {
      const context = await press(-1001234567890, 'action:7:interested');

      expect(actions.record).toHaveBeenCalledWith(7, VacancyActionKindEnum.INTERESTED, 555);
      expect(editedLabels(context)).toEqual(['✓ Interested', 'Skip', 'Applied']);
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

    it('leaves the card as it is when the pressed button is already ticked, and still confirms', async () => {
      const context = await pressButton({
        chatId: -1001234567890,
        data: 'action:7:interested',
        current: actionKeyboard(7, VacancyActionKindEnum.INTERESTED)
      });

      expect(actions.record).toHaveBeenCalledWith(7, VacancyActionKindEnum.INTERESTED, 555);
      expect(context.editMessageReplyMarkup).not.toHaveBeenCalled();
      expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Saved' });
    });

    it('edits the card when another button is ticked now', async () => {
      const context = await pressButton({
        chatId: -1001234567890,
        data: 'action:7:applied',
        current: actionKeyboard(7, VacancyActionKindEnum.INTERESTED)
      });

      expect(editedLabels(context)).toEqual(['Interested', 'Skip', '✓ Applied']);
    });

    it('takes the edit Telegram refuses as not modified as a debug line and still confirms', async () => {
      const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const context = await pressButton({
        chatId: -1001234567890,
        data: 'action:7:interested',
        editError: telegramError(
          'Bad Request: message is not modified: specified new message content and reply markup are exactly the same'
        )
      });

      expect(debug).toHaveBeenCalledWith({ message: 'Card buttons already shown' });
      expect(error).not.toHaveBeenCalled();
      expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Saved' });
    });

    it('lets another refused edit fail the update', async () => {
      await expect(
        pressButton({
          chatId: -1001234567890,
          data: 'action:7:interested',
          editError: telegramError('Bad Request: message to edit not found')
        })
      ).rejects.toBeInstanceOf(GrammyError);
    });

    it('lets an edit that fails for another reason fail the update', async () => {
      await expect(
        pressButton({ chatId: -1001234567890, data: 'action:7:interested', editError: new Error('socket hang up') })
      ).rejects.toThrow('socket hang up');
    });

    describe('under a candidate card', () => {
      it('adds the board, leaves only the ticked Add and confirms', async () => {
        candidates.decide.mockResolvedValue(SourceCandidateStatusEnum.ADDED);

        const context = await pressButton({ chatId: -1001234567890, data: 'candidate:5:add', current: candidateKeyboard(5) });

        expect(candidates.decide).toHaveBeenCalledWith(5, SourceCandidateDecisionEnum.ADD);
        expect(editedLabels(context)).toEqual(['✓ Add as a source']);
        expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Added — the first scan is queued' });
      });

      it('ignores the board, ticks Ignore and confirms', async () => {
        candidates.decide.mockResolvedValue(SourceCandidateStatusEnum.IGNORED);

        const context = await pressButton({ chatId: -1001234567890, data: 'candidate:5:ignore' });

        expect(candidates.decide).toHaveBeenCalledWith(5, SourceCandidateDecisionEnum.IGNORE);
        expect(editedLabels(context)).toEqual(['Add as a source', '✓ Ignore']);
        expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Ignored — it will not be offered again' });
      });

      it('does not edit a card whose board is already added, and still confirms', async () => {
        candidates.decide.mockResolvedValue(SourceCandidateStatusEnum.ADDED);

        const context = await pressButton({
          chatId: -1001234567890,
          data: 'candidate:5:add',
          current: candidateKeyboard(5, SourceCandidateStatusEnum.ADDED)
        });

        expect(context.editMessageReplyMarkup).not.toHaveBeenCalled();
        expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Added — the first scan is queued' });
      });

      it('tells the owner a board that is no longer known and edits nothing', async () => {
        candidates.decide.mockResolvedValue(undefined);

        const context = await pressButton({ chatId: -1001234567890, data: 'candidate:99:add' });

        expect(context.editMessageReplyMarkup).not.toHaveBeenCalled();
        expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'This board is no longer known' });
      });

      it('confirms a decision without a ready answer as saved', async () => {
        candidates.decide.mockResolvedValue(SourceCandidateStatusEnum.PROPOSED);

        const context = await pressButton({ chatId: -1001234567890, data: 'candidate:5:add' });

        expect(context.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Saved' });
      });

      it('ignores a press from another chat', async () => {
        const context = await pressButton({ chatId: 42, data: 'candidate:5:add' });

        expect(candidates.decide).not.toHaveBeenCalled();
        expect(context.answerCallbackQuery).toHaveBeenCalledWith();
      });
    });
  });
});
