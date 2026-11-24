import { InlineKeyboard } from 'grammy';

import { VacancyActionKindEnum, VacancyMatchVerdictEnum, WorkModeEnum } from '@job-agent/shared';

import { MatchRuleEnum } from '../../matching/enums/match-rule.enum.js';
import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';
import { VACANCY_FIELD_LIMITS, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import type { ISourceNotice, IVacancyNotice } from '../interfaces/vacancy-notice.interface.js';

/**
 * Prefix of the callback data of an action button: `action:<vacancy id>:<kind>`
 *
 * @type {string}
 */
const ACTION_PREFIX = 'action';

/**
 * Callback data of an action button, parsed by the bot
 *
 * @type {RegExp}
 */
export const ACTION_DATA = new RegExp(`^${ACTION_PREFIX}:(\\d+):(${Object.values(VacancyActionKindEnum).join('|')})$`);

/**
 * Header of a card by verdict
 *
 * @type {Readonly<Record<VacancyMatchVerdictEnum, string>>}
 */
const VERDICT_HEADERS: Readonly<Record<VacancyMatchVerdictEnum, string>> = {
  [VacancyMatchVerdictEnum.FIT]: '✅ Fits',
  [VacancyMatchVerdictEnum.ALMOST]: '🟡 Almost',
  [VacancyMatchVerdictEnum.NO_FIT]: '⛔ Does not fit'
};

/**
 * Work mode as a card writes it
 *
 * @type {Readonly<Record<WorkModeEnum, string>>}
 */
const WORK_MODES: Readonly<Record<WorkModeEnum, string>> = {
  [WorkModeEnum.ONSITE]: 'on-site',
  [WorkModeEnum.HYBRID]: 'hybrid',
  [WorkModeEnum.REMOTE]: 'remote'
};

/**
 * Labels of the action buttons
 *
 * @type {Readonly<Record<VacancyActionKindEnum, string>>}
 */
const ACTION_LABELS: Readonly<Record<VacancyActionKindEnum, string>> = {
  [VacancyActionKindEnum.INTERESTED]: 'Interested',
  [VacancyActionKindEnum.SKIPPED]: 'Skip',
  [VacancyActionKindEnum.APPLIED]: 'Applied'
};

/**
 * Text safe inside Telegram HTML
 *
 * @param {string} text
 *
 * @returns {string}
 */
export function escapeHTML(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/**
 * Title, company, place and the link — the part every message about a vacancy has; title and company clipped before
 * escaping, so a card stays within the Telegram limit and no entity is cut in half
 *
 * @param {IVacancyNotice} vacancy
 *
 * @returns {string[]}
 */
function vacancyLines(vacancy: IVacancyNotice): string[] {
  const place = [vacancy.city, vacancy.country].filter(Boolean).join(', ');
  const where = [place, vacancy.workMode ? WORK_MODES[vacancy.workMode] : ''].filter(Boolean).join(' · ');

  const title = clipText(vacancy.title, VACANCY_FIELD_LIMITS.title);
  const company = clipText(vacancy.company, VACANCY_FIELD_LIMITS.company);

  return [`<b>${escapeHTML(title)}</b>`, escapeHTML(company), ...(where ? [`📍 ${escapeHTML(where)}`] : [])];
}

/**
 * The line a finding adds to a card, or undefined for one a card does not show
 *
 * @param {IMatchReason} reason
 *
 * @returns {string | undefined}
 */
function reasonLine(reason: IMatchReason): string | undefined {
  const params = reason.params ?? {};

  if (reason.rule === MatchRuleEnum.LANGUAGES && Array.isArray(params.matched)) {
    return `💻 ${escapeHTML(params.matched.map(String).join(', '))}`;
  }

  if (reason.rule === MatchRuleEnum.LANGUAGES && reason.effect === VacancyMatchVerdictEnum.ALMOST) {
    return '⚠ no programming language named';
  }

  if (reason.rule === MatchRuleEnum.EXPERIENCE) {
    return `⚠ requires ${String(params.required)}+ years`;
  }

  if (reason.rule === MatchRuleEnum.HEBREW && reason.effect === VacancyMatchVerdictEnum.FIT) {
    return '🇮🇱 Hebrew is a plus';
  }

  return undefined;
}

/**
 * The link to the vacancy page
 *
 * @param {IVacancyNotice} vacancy
 *
 * @returns {string}
 */
function link(vacancy: IVacancyNotice): string {
  return `<a href="${escapeHTML(vacancy.url)}">Open the vacancy</a>`;
}

/**
 * Card of a `fit` or `almost` verdict: title, company, place, matched languages and the marks — never the owner's
 * own years
 *
 * @param {IVacancyNotice} vacancy
 *
 * @returns {string}
 */
export function formatMatchCard(vacancy: IVacancyNotice): string {
  const header = vacancy.verdict ? VERDICT_HEADERS[vacancy.verdict] : '';
  const marks = vacancy.reasons.map(reasonLine).filter(line => line !== undefined);

  return [header, ...vacancyLines(vacancy), ...marks, link(vacancy)].filter(Boolean).join('\n');
}

/**
 * Message about a vacancy gone from its page or closed by its company
 *
 * @param {IVacancyNotice} vacancy
 *
 * @returns {string}
 */
export function formatClosedNotice(vacancy: IVacancyNotice): string {
  return ['❌ Closed', ...vacancyLines(vacancy), link(vacancy)].join('\n');
}

/**
 * Message about a vacancy whose page changed, with its verdict now
 *
 * @param {IVacancyNotice} vacancy
 *
 * @returns {string}
 */
export function formatChangedNotice(vacancy: IVacancyNotice): string {
  const verdict = vacancy.verdict ? `Now: ${VERDICT_HEADERS[vacancy.verdict]}` : '';
  const marks = vacancy.reasons.map(reasonLine).filter(line => line !== undefined);

  return ['✏️ Changed', ...vacancyLines(vacancy), verdict, ...marks, link(vacancy)].filter(Boolean).join('\n');
}

/**
 * Message about a source the crawler stopped, with what to do
 *
 * @param {ISourceNotice} source
 *
 * @returns {string}
 */
export function formatSourceBlockedNotice(source: ISourceNotice): string {
  return [
    `⛔ Source stopped: <b>${escapeHTML(source.name)}</b>`,
    `Status: ${escapeHTML(source.status)}`,
    ...(source.error ? [escapeHTML(source.error)] : []),
    escapeHTML(source.url),
    'Scans resume after source_status is set back to ok.'
  ].join('\n');
}

/**
 * Buttons under a card; the pressed one is ticked, the others stay so the choice can change
 *
 * @param {number} vacancyId
 * @param {VacancyActionKindEnum} [chosen]
 *
 * @returns {InlineKeyboard}
 */
export function actionKeyboard(vacancyId: number, chosen?: VacancyActionKindEnum): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const kind of Object.values(VacancyActionKindEnum)) {
    keyboard.text(`${kind === chosen ? '✓ ' : ''}${ACTION_LABELS[kind]}`, `${ACTION_PREFIX}:${vacancyId}:${kind}`);
  }

  return keyboard;
}
