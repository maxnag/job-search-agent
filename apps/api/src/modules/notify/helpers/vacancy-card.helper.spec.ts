import { describe, expect, it } from 'vitest';

import { VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import { MatchRuleEnum } from '../../matching/enums/match-rule.enum.js';
import type { IVacancyNotice } from '../interfaces/vacancy-notice.interface.js';
import {
  ACTION_DATA,
  actionKeyboard,
  formatChangedNotice,
  formatClosedNotice,
  formatJobMailDisabledNotice,
  formatMatchCard,
  formatSourceBlockedNotice
} from './vacancy-card.helper.js';

const NOTICE: IVacancyNotice = {
  vacancyId: 7,
  title: 'Senior Backend Developer',
  company: 'Northwind',
  city: 'Haifa',
  country: 'IL',
  workMode: WorkModeEnum.HYBRID,
  url: 'https://careers.example.com/jobs/7?ref=a&b=c',
  textURL: null,
  stage: VacancyStageEnum.EXTRACTED,
  verdict: VacancyMatchVerdictEnum.FIT,
  reasons: [
    {
      rule: MatchRuleEnum.LANGUAGES,
      effect: VacancyMatchVerdictEnum.FIT,
      message: 'matches TypeScript',
      params: { matched: ['TypeScript'] }
    }
  ]
};

const LINK = '<a href="https://careers.example.com/jobs/7?ref=a&amp;b=c">Open the vacancy</a>';

describe('formatMatchCard', () => {
  it('shows the verdict, title, company, place, matched languages and the link', () => {
    expect(formatMatchCard(NOTICE)).toBe(
      ['✅ Fits', '<b>Senior Backend Developer</b>', 'Northwind', '📍 Haifa, IL · hybrid', '💻 TypeScript', LINK].join('\n')
    );
  });

  it('links the posting on the company board next to the vacancy when its description was read there', () => {
    const card = formatMatchCard({
      ...NOTICE,
      url: 'https://www.linkedin.com/jobs/view/4100000001/',
      textURL: 'https://jobs.lever.co/northwind/a1?x=1&y=2'
    });

    expect(card.split('\n').at(-1)).toBe(
      '<a href="https://www.linkedin.com/jobs/view/4100000001/">Open the vacancy</a> · ' +
        '<a href="https://jobs.lever.co/northwind/a1?x=1&amp;y=2">On the company board</a>'
    );
  });

  it('shows the marks of an almost verdict and leaves out findings a card does not show', () => {
    const card = formatMatchCard({
      ...NOTICE,
      city: null,
      country: null,
      workMode: null,
      verdict: VacancyMatchVerdictEnum.ALMOST,
      reasons: [
        { rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.ALMOST, message: 'the vacancy names no programming language' },
        { rule: MatchRuleEnum.EXPERIENCE, effect: VacancyMatchVerdictEnum.ALMOST, message: 'requires 8+ years', params: { required: 8 } },
        { rule: MatchRuleEnum.HEBREW, effect: VacancyMatchVerdictEnum.FIT, message: 'Hebrew is an advantage' },
        { rule: MatchRuleEnum.HEBREW, effect: VacancyMatchVerdictEnum.NO_FIT, message: 'Hebrew is required' },
        { rule: MatchRuleEnum.PLACE, effect: VacancyMatchVerdictEnum.NO_FIT, message: 'country US is not searched' }
      ]
    });

    expect(card).toBe(
      [
        '🟡 Almost',
        '<b>Senior Backend Developer</b>',
        'Northwind',
        '⚠ no programming language named',
        '⚠ requires 8+ years',
        '🇮🇱 Hebrew is a plus',
        LINK
      ].join('\n')
    );
  });

  it('escapes everything that came from a page', () => {
    const card = formatMatchCard({
      ...NOTICE,
      title: '<a href="https://phish.example">Click</a>',
      company: 'Tom & "Jerry"',
      city: '<b>',
      reasons: [{ rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.FIT, message: '', params: { matched: ['<i>C#</i>'] } }]
    });

    expect(card).toContain('<b>&lt;a href=&quot;https://phish.example&quot;&gt;Click&lt;/a&gt;</b>');
    expect(card).toContain('Tom &amp; &quot;Jerry&quot;');
    expect(card).toContain('📍 &lt;b&gt;, IL · hybrid');
    expect(card).toContain('💻 &lt;i&gt;C#&lt;/i&gt;');
  });

  it('clips a planted long title and company before escaping them', () => {
    const card = formatMatchCard({ ...NOTICE, title: '&'.repeat(1000), company: 'c'.repeat(1000) });
    const [, title, company] = card.split('\n');

    expect(title).toBe(`<b>${'&amp;'.repeat(199)}…</b>`);
    expect(company).toBe(`${'c'.repeat(119)}…`);
  });

  it('leaves the header out without a verdict', () => {
    expect(formatMatchCard({ ...NOTICE, verdict: null }).split('\n')[0]).toBe('<b>Senior Backend Developer</b>');
  });
});

describe('formatClosedNotice', () => {
  it('says the vacancy is closed', () => {
    expect(formatClosedNotice(NOTICE)).toBe(
      ['❌ Closed', '<b>Senior Backend Developer</b>', 'Northwind', '📍 Haifa, IL · hybrid', LINK].join('\n')
    );
  });
});

describe('formatChangedNotice', () => {
  it('says the vacancy changed, with its verdict now and the marks', () => {
    expect(formatChangedNotice({ ...NOTICE, verdict: VacancyMatchVerdictEnum.NO_FIT })).toBe(
      [
        '✏️ Changed',
        '<b>Senior Backend Developer</b>',
        'Northwind',
        '📍 Haifa, IL · hybrid',
        'Now: ⛔ Does not fit',
        '💻 TypeScript',
        LINK
      ].join('\n')
    );
  });

  it('leaves the verdict out when there is none', () => {
    expect(formatChangedNotice({ ...NOTICE, verdict: null, reasons: [] })).not.toContain('Now:');
  });
});

describe('formatSourceBlockedNotice', () => {
  it('names the source, its status, the error and what to do', () => {
    expect(
      formatSourceBlockedNotice({ name: 'Northwind <Careers>', url: 'https://careers.example.com', status: 'blocked', error: 'HTTP 403' })
    ).toBe(
      [
        '⛔ Source stopped: <b>Northwind &lt;Careers&gt;</b>',
        'Status: blocked',
        'HTTP 403',
        'https://careers.example.com',
        'Scans resume after source_status is set back to ok.'
      ].join('\n')
    );
  });

  it('leaves the error line out when there is none', () => {
    expect(
      formatSourceBlockedNotice({ name: 'Northwind', url: 'https://x.example', status: 'blocked_by_robots', error: null }).split('\n')
    ).toHaveLength(4);
  });
});

describe('formatJobMailDisabledNotice', () => {
  it('says the mail is off and which keys to check, without the account', () => {
    expect(formatJobMailDisabledNotice().split('\n')).toEqual([
      '📭 Job mail is off',
      'The mailbox refused the account or its app password.',
      'Check JOB_MAIL_IMAP_USER and JOB_MAIL_IMAP_PASSWORD in .env, then restart the API.'
    ]);
  });
});

describe('actionKeyboard', () => {
  it('has a button per action whose data the bot can parse back', () => {
    const buttons = actionKeyboard(7).inline_keyboard.flat();

    expect(buttons.map(button => button.text)).toEqual(['Interested', 'Skip', 'Applied']);

    for (const [index, kind] of Object.values(VacancyActionKindEnum).entries()) {
      const data = (buttons[index] as { callback_data: string }).callback_data;

      expect(ACTION_DATA.exec(data)?.slice(1)).toEqual(['7', kind]);
    }
  });

  it('ticks the chosen action only', () => {
    const buttons = actionKeyboard(7, VacancyActionKindEnum.APPLIED).inline_keyboard.flat();

    expect(buttons.map(button => button.text)).toEqual(['Interested', 'Skip', '✓ Applied']);
  });
});

describe('ACTION_DATA', () => {
  it.each(['action:7:unknown', 'action:x:interested', 'other:7:interested', 'action:7:interested:extra'])('refuses %j', data => {
    expect(ACTION_DATA.test(data)).toBe(false);
  });
});
