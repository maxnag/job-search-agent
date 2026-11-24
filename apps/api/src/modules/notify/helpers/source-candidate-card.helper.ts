import { InlineKeyboard } from 'grammy';

import { ATSKindEnum, SourceCandidateStatusEnum } from '@job-agent/shared';

import { boardURL } from '../../ats/helpers/a-t-s-board.helper.js';
import { SourceCandidateDecisionEnum } from '../../discovery/enums/source-candidate-decision.enum.js';
import type { SourceCandidateRowType } from '../../discovery/interfaces/source-candidate-row.interface.js';
import { VACANCY_FIELD_LIMITS, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import { escapeHTML } from './vacancy-card.helper.js';

/**
 * Prefix of the callback data of a candidate button: `candidate:<candidate id>:<decision>`
 *
 * @type {string}
 */
const CANDIDATE_PREFIX = 'candidate';

/**
 * Callback data of a candidate button, parsed by the bot
 *
 * @type {RegExp}
 */
export const CANDIDATE_DATA = new RegExp(`^${CANDIDATE_PREFIX}:(\\d+):(${Object.values(SourceCandidateDecisionEnum).join('|')})$`);

/**
 * Name of each applicant tracking system as a card writes it
 *
 * @type {Readonly<Record<ATSKindEnum, string>>}
 */
const ATS_NAMES: Readonly<Record<ATSKindEnum, string>> = {
  [ATSKindEnum.COMEET]: 'Comeet',
  [ATSKindEnum.GREENHOUSE]: 'Greenhouse',
  [ATSKindEnum.LEVER]: 'Lever'
};

/**
 * Labels of the candidate buttons
 *
 * @type {Readonly<Record<SourceCandidateDecisionEnum, string>>}
 */
const DECISION_LABELS: Readonly<Record<SourceCandidateDecisionEnum, string>> = {
  [SourceCandidateDecisionEnum.ADD]: 'Add as a source',
  [SourceCandidateDecisionEnum.IGNORE]: 'Ignore'
};

/**
 * The decision each status stands for, to tick its button
 *
 * @type {ReadonlyMap<SourceCandidateStatusEnum, SourceCandidateDecisionEnum>}
 */
const CHOSEN_DECISIONS: ReadonlyMap<SourceCandidateStatusEnum, SourceCandidateDecisionEnum> = new Map([
  [SourceCandidateStatusEnum.ADDED, SourceCandidateDecisionEnum.ADD],
  [SourceCandidateStatusEnum.IGNORED, SourceCandidateDecisionEnum.IGNORE]
]);

/**
 * Card of a company board the discovery proposes: the company, the system, how many positions the profiles want, a few
 * of them and the link to the board — values clipped before escaping
 *
 * @param {SourceCandidateRowType} candidate
 *
 * @returns {string}
 */
export function formatSourceCandidateCard(candidate: SourceCandidateRowType): string {
  const url = boardURL({ kind: candidate.source_candidate_ats_kind, board: candidate.source_candidate_board });
  const company = escapeHTML(clipText(candidate.source_candidate_company, VACANCY_FIELD_LIMITS.company));
  const counts = `${candidate.source_candidate_positions} positions, ${candidate.source_candidate_matching} in your countries and work modes`;
  const unknown =
    candidate.source_candidate_unknown > 0 ? [`${candidate.source_candidate_unknown} without a known country or work mode`] : [];

  return [
    `🏢 New company board: <b>${company}</b> (${ATS_NAMES[candidate.source_candidate_ats_kind]})`,
    counts,
    ...unknown,
    ...candidate.source_candidate_examples.map(example => `• ${escapeHTML(clipText(example, VACANCY_FIELD_LIMITS.title))}`),
    `<a href="${escapeHTML(url)}">Open the board</a>`
  ].join('\n');
}

/**
 * Buttons under a candidate card: the decision taken is ticked; an added board keeps only its tick
 *
 * @param {number} sourceCandidateId
 * @param {SourceCandidateStatusEnum} [status]
 *
 * @returns {InlineKeyboard}
 */
export function candidateKeyboard(sourceCandidateId: number, status?: SourceCandidateStatusEnum): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const chosen = status ? CHOSEN_DECISIONS.get(status) : undefined;
  const decisions =
    chosen === SourceCandidateDecisionEnum.ADD ? [SourceCandidateDecisionEnum.ADD] : Object.values(SourceCandidateDecisionEnum);

  for (const decision of decisions) {
    keyboard.text(`${decision === chosen ? '✓ ' : ''}${DECISION_LABELS[decision]}`, `${CANDIDATE_PREFIX}:${sourceCandidateId}:${decision}`);
  }

  return keyboard;
}
