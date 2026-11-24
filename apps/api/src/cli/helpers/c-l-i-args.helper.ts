import { parseArgs } from 'node:util';

import { HELP_OPTION, formatCLIHelp } from './c-l-i-help.helper.js';
import { closestWord, shellCommand } from './c-l-i-suggestion.helper.js';
import type { ICLIArgs, ICLIParseResult } from './interfaces/c-l-i-args.interface.js';
import type { ICLIOption, ICLISpec } from './interfaces/c-l-i-spec.interface.js';

/**
 * The line every error ends with
 *
 * @type {string}
 */
const HELP_HINT = 'Run with --help for usage.';

/**
 * A whole number greater than zero
 *
 * @type {RegExp}
 */
const POSITIVE_INTEGER = /^[1-9]\d*$/;

/**
 * Split the command line into options and positionals — nothing is checked or assigned yet
 *
 * @param {readonly string[]} argv
 *
 * @returns {Token[]}
 */
function lex(argv: readonly string[]) {
  return parseArgs({ args: [...argv], options: {}, strict: false, allowPositionals: true, tokens: true }).tokens;
}

/**
 * A word of the command line as `parseArgs` splits it
 */
type Token = ReturnType<typeof lex>[number];

/**
 * An option word of the command line
 */
type OptionToken = Extract<Token, { kind: 'option' }>;

/**
 * What reading the command line has collected so far
 */
interface IParseState {
  /**
   * The command line, corrected where a suggestion was found
   *
   * @var {string[]}
   */
  readonly words: string[];

  /**
   * One line per mistake
   *
   * @var {string[]}
   */
  readonly errors: string[];

  /**
   * Positional arguments
   *
   * @var {string[]}
   */
  readonly positionals: string[];

  /**
   * Values by option
   *
   * @var {Map<string, string[]>}
   */
  readonly values: Map<string, string[]>;

  /**
   * Flags given
   *
   * @var {Set<string>}
   */
  readonly flags: Set<string>;

  /**
   * Positions of the tokens taken as option values
   *
   * @var {Set<number>}
   */
  readonly consumed: Set<number>;

  /**
   * Every mistake so far has a correction
   *
   * @var {boolean}
   */
  fixable: boolean;
}

/**
 * The option a word names, by its long or short name
 *
 * @param {readonly ICLIOption[]} options
 * @param {OptionToken} token
 *
 * @returns {ICLIOption | undefined}
 */
function findOption(options: readonly ICLIOption[], token: OptionToken): ICLIOption | undefined {
  const isLong = token.rawName.startsWith('--');

  return options.find(option => (isLong ? option.name === token.name : option.short === token.name));
}

/**
 * Record a mistake that has no correction
 *
 * @param {IParseState} state
 * @param {string} error
 *
 * @returns {void}
 */
function fail(state: IParseState, error: string): void {
  state.errors.push(error);
  state.fixable = false;
}

/**
 * The option an unknown word was meant to be — recorded as a mistake, the word corrected when one option is close
 *
 * @param {readonly ICLIOption[]} options
 * @param {IParseState} state
 * @param {OptionToken} token
 *
 * @returns {ICLIOption | undefined}
 */
function guessOption(options: readonly ICLIOption[], state: IParseState, token: OptionToken): ICLIOption | undefined {
  const name = token.rawName.startsWith('--')
    ? closestWord(
        token.name,
        options.map(option => option.name)
      )
    : undefined;
  const option = options.find(candidate => candidate.name === name);

  state.errors.push(`Unknown option ${token.rawName}.`);

  if (!option) {
    state.fixable = false;

    return undefined;
  }

  state.words[token.index] = token.inlineValue ? `--${option.name}=${token.value ?? ''}` : `--${option.name}`;

  return option;
}

/**
 * Check a value against what the option accepts; a mistyped choice is corrected in the command line
 *
 * @param {ICLIOption} option
 * @param {IParseState} state
 * @param {string} value
 * @param {(fixed: string) => void} correct
 *
 * @returns {void}
 */
function checkValue(option: ICLIOption, state: IParseState, value: string, correct: (fixed: string) => void): void {
  if (option.choices && !option.choices.includes(value)) {
    const fixed = closestWord(value, option.choices);

    state.errors.push(`Option --${option.name} takes one of ${option.choices.join(', ')} — not ${value}.`);

    if (fixed) {
      correct(fixed);
    } else {
      state.fixable = false;
    }
  }

  if (option.integer && !POSITIVE_INTEGER.test(value)) {
    fail(state, `Option --${option.name} takes a whole number greater than zero — not ${value}.`);
  }
}

/**
 * Read one option word and, for an option with a value, the word after it
 *
 * @param {readonly ICLIOption[]} options
 * @param {IParseState} state
 * @param {readonly Token[]} tokens
 * @param {number} position
 *
 * @returns {void}
 */
function readOption(options: readonly ICLIOption[], state: IParseState, tokens: readonly Token[], position: number): void {
  const token = tokens[position];

  if (token?.kind !== 'option') {
    return;
  }

  const option = findOption(options, token) ?? guessOption(options, state, token);

  if (!option) {
    return;
  }

  if (!option.value) {
    if (token.inlineValue) {
      fail(state, `Option --${option.name} takes no value.`);
    } else {
      state.flags.add(option.name);
    }

    return;
  }

  const next = tokens[position + 1];
  let value: string;
  let correct: (fixed: string) => void;

  if (token.inlineValue) {
    value = token.value;
    correct = fixed => (state.words[token.index] = `--${option.name}=${fixed}`);
  } else if (next?.kind === 'positional') {
    value = next.value;
    correct = fixed => (state.words[next.index] = fixed);
    state.consumed.add(position + 1);
  } else {
    fail(state, `Option --${option.name} needs a value <${option.value}>.`);

    return;
  }

  checkValue(option, state, value, correct);

  const given = state.values.get(option.name) ?? [];

  if (given.length > 0 && !option.multiple) {
    fail(state, `Option --${option.name} is given more than once.`);

    return;
  }

  state.values.set(option.name, [...given, value]);
}

/**
 * Check the arguments and the required options once every word is read
 *
 * @param {ICLISpec} spec
 * @param {IParseState} state
 *
 * @returns {void}
 */
function checkCompleteness(spec: ICLISpec, state: IParseState): void {
  const expected = spec.arguments ?? [];

  for (const option of spec.options ?? []) {
    if (option.required && !state.values.has(option.name)) {
      fail(state, `Missing option --${option.name} <${option.value ?? ''}>.`);
    }
  }

  expected.forEach((argument, position) => {
    if (argument.required && state.positionals[position] === undefined) {
      fail(state, `Missing argument <${argument.name}>.`);
    }
  });

  for (const extra of state.positionals.slice(expected.length)) {
    fail(state, `Unexpected argument ${extra}.`);
  }
}

/**
 * Read a command line against the description of the command: the help for `--help` / `-h`, every mistake with a
 * corrected command when each one has a correction, or the arguments
 *
 * @param {ICLISpec} spec
 * @param {readonly string[]} argv
 *
 * @returns {ICLIParseResult}
 */
export function parseCLI(spec: ICLISpec, argv: readonly string[]): ICLIParseResult {
  const tokens = lex(argv);
  const options = spec.options ?? [];

  if (tokens.some(token => token.kind === 'option' && findOption([HELP_OPTION], token))) {
    return { output: formatCLIHelp(spec), exitCode: 0 };
  }

  const state: IParseState = {
    words: [...argv],
    errors: [],
    positionals: [],
    values: new Map(),
    flags: new Set(),
    consumed: new Set(),
    fixable: true
  };

  tokens.forEach((token, position) => {
    if (token.kind === 'option') {
      readOption(options, state, tokens, position);
    } else if (token.kind === 'positional' && !state.consumed.has(position)) {
      state.positionals.push(token.value);
    }
  });

  checkCompleteness(spec, state);

  if (state.errors.length === 0) {
    const args: ICLIArgs = { positionals: state.positionals, values: Object.fromEntries(state.values), flags: state.flags };

    return { args };
  }

  const fix = state.fixable ? [`Did you mean: ${shellCommand(['pnpm', spec.command, ...state.words])}`] : [];

  return { output: [...state.errors, ...fix, HELP_HINT].join('\n') + '\n', exitCode: 1 };
}

/**
 * Read the command line of the running command: print the help or the mistakes and set the exit code when it may not
 * run — before any module is started, so neither the database nor Redis is needed for that
 *
 * @param {ICLISpec} spec
 * @param {readonly string[]} [argv]
 *
 * @returns {ICLIArgs | undefined}
 */
export function readCLI(spec: ICLISpec, argv: readonly string[] = process.argv.slice(2)): ICLIArgs | undefined {
  const result = parseCLI(spec, argv);

  if (result.output !== undefined) {
    (result.exitCode === 0 ? process.stdout : process.stderr).write(result.output);
    process.exitCode = result.exitCode;
  }

  return result.args;
}
