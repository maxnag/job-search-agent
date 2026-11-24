import { describe, expect, it } from 'vitest';

import { ATSKindEnum, SourceCandidateStatusEnum } from '@job-agent/shared';

import type { SourceCandidateRowType } from '../../discovery/interfaces/source-candidate-row.interface.js';
import { CANDIDATE_DATA, candidateKeyboard, formatSourceCandidateCard } from './source-candidate-card.helper.js';

/**
 * A candidate row of a card
 *
 * @param {Partial<SourceCandidateRowType>} changes
 *
 * @returns {SourceCandidateRowType}
 */
function candidate(changes: Partial<SourceCandidateRowType> = {}): SourceCandidateRowType {
  return {
    source_candidate_id: 5,
    source_candidate_ats_kind: ATSKindEnum.COMEET,
    source_candidate_board: 'fabrikam/A1.00B',
    source_candidate_company: 'Fabrikam & Sons',
    source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
    source_candidate_positions: 12,
    source_candidate_matching: 3,
    source_candidate_unknown: 0,
    source_candidate_examples: ['Backend Developer — Haifa', 'QA <Lead>'],
    ...changes
  } as SourceCandidateRowType;
}

/**
 * Labels and data of the buttons of a keyboard
 *
 * @param {ReturnType<typeof candidateKeyboard>} keyboard
 *
 * @returns {[string, string][]}
 */
function buttons(keyboard: ReturnType<typeof candidateKeyboard>): [string, string][] {
  return keyboard.inline_keyboard.flat().map(button => [button.text, 'callback_data' in button ? button.callback_data : '']);
}

describe('formatSourceCandidateCard', () => {
  it('shows the company, the system, the counts, the examples and the board link, escaped', () => {
    expect(formatSourceCandidateCard(candidate())).toBe(
      [
        '🏢 New company board: <b>Fabrikam &amp; Sons</b> (Comeet)',
        '12 positions, 3 in your countries and work modes',
        '• Backend Developer — Haifa',
        '• QA &lt;Lead&gt;',
        '<a href="https://www.comeet.com/jobs/fabrikam/A1.00B">Open the board</a>'
      ].join('\n')
    );
  });

  it('names the positions without a known country or work mode', () => {
    expect(formatSourceCandidateCard(candidate({ source_candidate_unknown: 4 }))).toContain('\n4 without a known country or work mode\n');
  });

  it('shows a card without examples', () => {
    const card = formatSourceCandidateCard(
      candidate({ source_candidate_ats_kind: ATSKindEnum.LEVER, source_candidate_board: 'Contoso', source_candidate_examples: [] })
    );

    expect(card).toContain('(Lever)');
    expect(card).not.toContain('•');
    expect(card).toContain('href="https://jobs.lever.co/Contoso"');
  });

  it('clips a long company name and a long example', () => {
    const card = formatSourceCandidateCard(
      candidate({ source_candidate_company: 'C'.repeat(300), source_candidate_examples: ['E'.repeat(500)] })
    );

    expect(card).not.toContain('C'.repeat(121));
    expect(card).not.toContain('E'.repeat(201));
  });
});

describe('candidateKeyboard', () => {
  it('offers both decisions on a new card', () => {
    expect(buttons(candidateKeyboard(5))).toEqual([
      ['Add as a source', 'candidate:5:add'],
      ['Ignore', 'candidate:5:ignore']
    ]);
  });

  it('keeps both decisions after Ignore and ticks it, so the owner can still add the board', () => {
    expect(buttons(candidateKeyboard(5, SourceCandidateStatusEnum.IGNORED))).toEqual([
      ['Add as a source', 'candidate:5:add'],
      ['✓ Ignore', 'candidate:5:ignore']
    ]);
  });

  it('leaves only the ticked Add once the board is a source', () => {
    expect(buttons(candidateKeyboard(5, SourceCandidateStatusEnum.ADDED))).toEqual([['✓ Add as a source', 'candidate:5:add']]);
  });

  it('ticks nothing for a status that is not a decision', () => {
    expect(buttons(candidateKeyboard(5, SourceCandidateStatusEnum.PROPOSED))).toEqual(buttons(candidateKeyboard(5)));
  });
});

describe('CANDIDATE_DATA', () => {
  it('reads the candidate and the decision of a button', () => {
    expect(CANDIDATE_DATA.exec('candidate:42:ignore')?.slice(1)).toEqual(['42', 'ignore']);
  });

  it.each(['candidate:42:delete', 'candidate:x:add', 'vacancy:42:add', 'candidate:42:add:extra'])('does not read %j', data => {
    expect(CANDIDATE_DATA.test(data)).toBe(false);
  });
});
