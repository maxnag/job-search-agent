import { paint } from '../../modules/report/helpers/terminal-style.helper.js';
import type { ICLIArgument, ICLIOption, ICLISpec } from './interfaces/c-l-i-spec.interface.js';

/**
 * Indent of a line inside a section
 *
 * @type {string}
 */
const INDENT = '  ';

/**
 * Gap between a label and its description
 *
 * @type {number}
 */
const GAP = 2;

/**
 * The option every command has
 *
 * @type {ICLIOption}
 */
export const HELP_OPTION: ICLIOption = { name: 'help', short: 'h', description: 'Show this help' };

/**
 * An argument as the usage line shows it
 *
 * @param {ICLIArgument} argument
 *
 * @returns {string}
 */
function argumentLabel(argument: ICLIArgument): string {
  return argument.required ? `<${argument.name}>` : `[<${argument.name}>]`;
}

/**
 * An option with its value placeholder
 *
 * @param {ICLIOption} option
 *
 * @returns {string}
 */
function optionUsage(option: ICLIOption): string {
  return option.value ? `--${option.name} <${option.value}>` : `--${option.name}`;
}

/**
 * An option as the options list shows it, the short name first
 *
 * @param {ICLIOption} option
 *
 * @returns {string}
 */
function optionLabel(option: ICLIOption): string {
  return (option.short ? `-${option.short}, ` : '    ') + optionUsage(option);
}

/**
 * The description of an option with what it accepts
 *
 * @param {ICLIOption} option
 *
 * @returns {string}
 */
function optionDescription(option: ICLIOption): string {
  const details = [
    option.choices ? `one of: ${option.choices.join(', ')}` : '',
    option.multiple ? 'repeatable' : '',
    option.required ? 'required' : ''
  ].filter(Boolean);

  return details.length > 0 ? `${option.description} (${details.join('; ')})` : option.description;
}

/**
 * Labels and their descriptions in two aligned columns
 *
 * @param {readonly (readonly [string, string])[]} rows
 *
 * @returns {string[]}
 */
function columns(rows: readonly (readonly [string, string])[]): string[] {
  const width = Math.max(...rows.map(([label]) => label.length)) + GAP;

  return rows.map(([label, description]) => INDENT + label.padEnd(width) + description);
}

/**
 * The usage line: required arguments and options, then `[options]` when there are optional ones
 *
 * @param {ICLISpec} spec
 *
 * @returns {string}
 */
function usage(spec: ICLISpec): string {
  const options = spec.options ?? [];
  const words = [
    `pnpm ${spec.command}`,
    ...(spec.arguments ?? []).map(argument => argumentLabel(argument)),
    ...options.filter(option => option.required).map(option => optionUsage(option)),
    '[options]'
  ];

  return `${paint('bold', 'Usage:')} ${words.join(' ')}`;
}

/**
 * A titled section, or nothing when it has no lines
 *
 * @param {string} title
 * @param {readonly string[]} lines
 *
 * @returns {string[]}
 */
function section(title: string, lines: readonly string[]): string[] {
  return lines.length > 0 ? ['', paint('bold', `${title}:`), ...lines] : [];
}

/**
 * The help of a command: usage, what it does, arguments, options, examples and notes
 *
 * @param {ICLISpec} spec
 *
 * @returns {string}
 */
export function formatCLIHelp(spec: ICLISpec): string {
  const argumentRows = (spec.arguments ?? []).map(argument => [`<${argument.name}>`, argument.description] as const);
  const optionRows = [...(spec.options ?? []), HELP_OPTION].map(option => [optionLabel(option), optionDescription(option)] as const);
  const examples = (spec.examples ?? []).flatMap(example => [
    INDENT + paint('cyan', `pnpm ${spec.command} ${example.args}`.trimEnd()),
    INDENT + INDENT + paint('dim', example.description)
  ]);
  const notes = (spec.notes ?? []).map(note => INDENT + note);
  const lines = [
    usage(spec),
    '',
    spec.summary,
    ...section('Arguments', argumentRows.length > 0 ? columns(argumentRows) : []),
    ...section('Options', columns(optionRows)),
    ...section('Examples', examples),
    ...section('Notes', notes)
  ];

  return `${lines.join('\n')}\n`;
}
