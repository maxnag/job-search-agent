import { styleText } from 'node:util';

import { SourceStatusEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import type { TextFormat } from '../interfaces/text-format.interface.js';

/**
 * Color of every verdict
 *
 * @type {Readonly<Record<VacancyMatchVerdictEnum, TextFormat>>}
 */
const VERDICT_FORMATS: Readonly<Record<VacancyMatchVerdictEnum, TextFormat>> = {
  [VacancyMatchVerdictEnum.FIT]: ['green', 'bold'],
  [VacancyMatchVerdictEnum.ALMOST]: 'yellow',
  [VacancyMatchVerdictEnum.NO_FIT]: 'red'
};

/**
 * Color of the stage cell
 *
 * @type {Readonly<Record<VacancyStageEnum, TextFormat>>}
 */
const STAGE_FORMATS: Readonly<Record<VacancyStageEnum, TextFormat>> = {
  [VacancyStageEnum.LISTED]: 'cyan',
  [VacancyStageEnum.SKIPPED]: 'dim',
  [VacancyStageEnum.EXTRACTED]: 'bold',
  [VacancyStageEnum.CLOSED]: 'gray'
};

/**
 * Style of a whole row by the stage of its vacancy — a dropped or closed position fades
 *
 * @type {Readonly<Partial<Record<VacancyStageEnum, TextFormat>>>}
 */
const ROW_FORMATS: Readonly<Partial<Record<VacancyStageEnum, TextFormat>>> = {
  [VacancyStageEnum.SKIPPED]: 'dim',
  [VacancyStageEnum.CLOSED]: ['gray', 'strikethrough']
};

/**
 * Color of every source status
 *
 * @type {Readonly<Record<SourceStatusEnum, TextFormat>>}
 */
const STATUS_FORMATS: Readonly<Record<SourceStatusEnum, TextFormat>> = {
  [SourceStatusEnum.OK]: 'green',
  [SourceStatusEnum.BLOCKED_BY_ROBOTS]: 'red',
  [SourceStatusEnum.BLOCKED]: 'red'
};

/**
 * Style a text for the standard output — plain when it is not a terminal or `NO_COLOR` is set
 *
 * @param {TextFormat} format
 * @param {string} text
 *
 * @returns {string}
 */
export function paint(format: TextFormat, text: string): string {
  return styleText(format, text);
}

/**
 * A text in the color of a verdict, the verdict itself by default
 *
 * @param {VacancyMatchVerdictEnum} verdict
 * @param {string} text
 *
 * @returns {string}
 */
export function paintVerdict(verdict: VacancyMatchVerdictEnum, text: string = verdict): string {
  return paint(VERDICT_FORMATS[verdict], text);
}

/**
 * A stage in its color
 *
 * @param {VacancyStageEnum} stage
 *
 * @returns {string}
 */
export function paintStage(stage: VacancyStageEnum): string {
  return paint(STAGE_FORMATS[stage], stage);
}

/**
 * A cell of a row in the style of the stage of its vacancy
 *
 * @param {VacancyStageEnum} stage
 * @param {string} text
 *
 * @returns {string}
 */
export function paintRow(stage: VacancyStageEnum, text: string): string {
  const format = ROW_FORMATS[stage];

  return format ? paint(format, text) : text;
}

/**
 * A source status in its color
 *
 * @param {SourceStatusEnum} status
 *
 * @returns {string}
 */
export function paintStatus(status: SourceStatusEnum): string {
  return paint(STATUS_FORMATS[status], status);
}
