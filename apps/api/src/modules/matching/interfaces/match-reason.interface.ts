import type { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { MatchRuleEnum } from '../enums/match-rule.enum.js';

/**
 * One finding of a rule: its effect on the verdict, a sentence for the report and the values the card is worded from.
 * An effect `fit` is a mark that does not lower the verdict (matched languages, Hebrew as an advantage)
 */
export interface IMatchReason {
  /**
   * Rule that found it
   *
   * @var {MatchRuleEnum}
   */
  readonly rule: MatchRuleEnum;

  /**
   * The verdict this finding allows at most
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly effect: VacancyMatchVerdictEnum;

  /**
   * What was found, in English
   *
   * @var {string}
   */
  readonly message: string;

  /**
   * Values of the finding: matched skills, required years …
   *
   * @var {Readonly<Record<string, unknown>>}
   */
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * The verdict for a vacancy against one resume version, with every finding
 */
export interface IMatchResult {
  /**
   * The worst effect among the findings; `fit` when none lowers it
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly verdict: VacancyMatchVerdictEnum;

  /**
   * Findings, in rule order
   *
   * @var {readonly IMatchReason[]}
   */
  readonly reasons: readonly IMatchReason[];
}
