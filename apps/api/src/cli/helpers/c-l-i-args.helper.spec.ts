import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseCLI, readCLI } from './c-l-i-args.helper.js';
import type { ICLISpec } from './interfaces/c-l-i-spec.interface.js';

vi.mock('node:util', async importOriginal => ({
  ...(await importOriginal<typeof import('node:util')>()),
  styleText: (_format: unknown, text: string) => text
}));

const SPEC: ICLISpec = {
  command: 'demo:run',
  summary: 'Run the demo.',
  arguments: [{ name: 'file', description: 'Input file', required: true }],
  options: [
    { name: 'source', value: 'id', description: 'Source', multiple: true, integer: true },
    { name: 'stage', short: 's', value: 'stage', description: 'Stage', multiple: true, choices: ['listed', 'skipped', 'closed'] },
    { name: 'title', value: 'text', description: 'Title' },
    { name: 'dry-run', description: 'Store nothing' }
  ]
};

const HINT = 'Run with --help for usage.';

/**
 * The output of a command line that may not run
 *
 * @param {string[]} argv
 * @param {ICLISpec} spec
 *
 * @returns {string | undefined}
 */
function errorOf(argv: string[], spec: ICLISpec = SPEC): string | undefined {
  const result = parseCLI(spec, argv);

  expect(result.exitCode).toBe(1);
  expect(result.args).toBeUndefined();

  return result.output;
}

describe('parseCLI', () => {
  it.each([['--help'], ['-h']])('prints the help for %s, whatever else is wrong', flag => {
    const result = parseCLI(SPEC, ['--sorce', flag]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: pnpm demo:run <file> [options]');
    expect(result.args).toBeUndefined();
  });

  it('reads arguments, repeated options, short names, inline values and flags', () => {
    const result = parseCLI(SPEC, ['in.txt', '--source', '7', '--source=9', '-s', 'closed', '--stage', 'listed', '--dry-run']);

    expect(result.output).toBeUndefined();
    expect(result.args?.positionals).toEqual(['in.txt']);
    expect(result.args?.values).toEqual({ source: ['7', '9'], stage: ['closed', 'listed'] });
    expect([...(result.args?.flags ?? [])]).toEqual(['dry-run']);
  });

  it('takes every word after -- as an argument', () => {
    expect(parseCLI(SPEC, ['--', '--title']).args?.positionals).toEqual(['--title']);
  });

  it.each([
    ['an unknown option with no close one', ['in.txt', '--x'], 'Unknown option --x.'],
    ['an option without its value', ['in.txt', '--title'], 'Option --title needs a value <text>.'],
    ['a value that is the next option', ['in.txt', '--title', '--dry-run'], 'Option --title needs a value <text>.'],
    ['a flag with a value', ['in.txt', '--dry-run=yes'], 'Option --dry-run takes no value.'],
    ['a single option given twice', ['in.txt', '--title', 'a', '--title', 'b'], 'Option --title is given more than once.'],
    ['a value outside the choices', ['in.txt', '--stage', 'open'], 'Option --stage takes one of listed, skipped, closed — not open.'],
    ['a number that is not whole', ['in.txt', '--source', '1.5'], 'Option --source takes a whole number greater than zero — not 1.5.'],
    ['zero for a number', ['in.txt', '--source', '0'], 'Option --source takes a whole number greater than zero — not 0.'],
    ['a missing argument', [], 'Missing argument <file>.'],
    ['an unexpected argument', ['in.txt', 'out.txt'], 'Unexpected argument out.txt.']
  ])('rejects %s in one line', (_case, argv, line) => {
    expect(errorOf(argv)).toBe(`${line}\n${HINT}\n`);
  });

  it('rejects a missing required option', () => {
    const spec: ICLISpec = {
      command: 'demo:import',
      summary: 'Import.',
      options: [{ name: 'profile', value: 'name', description: 'Profile', required: true }]
    };

    expect(errorOf([], spec)).toBe(`Missing option --profile <name>.\n${HINT}\n`);
  });

  it('suggests the corrected command, keeping the other arguments, when an option is mistyped', () => {
    expect(errorOf(['in.txt', '--sorce', '7', '--stage', 'skipped'])).toBe(
      `Unknown option --sorce.\nDid you mean: pnpm demo:run in.txt --source 7 --stage skipped\n${HINT}\n`
    );
  });

  it('corrects a mistyped value, inline too, and quotes a value with spaces', () => {
    expect(errorOf(['in.txt', '--stage', 'skiped', '--stage=closd', '--title', 'senior dev'])).toBe(
      [
        'Option --stage takes one of listed, skipped, closed — not skiped.',
        'Option --stage takes one of listed, skipped, closed — not closd.',
        "Did you mean: pnpm demo:run in.txt --stage skipped --stage=closed --title 'senior dev'",
        HINT,
        ''
      ].join('\n')
    );
  });

  it('checks the value of a mistyped option against the option it was meant to be', () => {
    expect(errorOf(['in.txt', '--stag', 'skiped'])).toBe(
      [
        'Unknown option --stag.',
        'Option --stage takes one of listed, skipped, closed — not skiped.',
        'Did you mean: pnpm demo:run in.txt --stage skipped',
        HINT,
        ''
      ].join('\n')
    );
  });

  it('suggests no command when one of the mistakes has no correction', () => {
    expect(errorOf(['in.txt', '--sorce', '7', '--x'])).toBe(`Unknown option --sorce.\nUnknown option --x.\n${HINT}\n`);
  });
});

describe('readCLI', () => {
  let exitCode: typeof process.exitCode;

  beforeEach(() => {
    exitCode = process.exitCode;
  });

  afterEach(() => {
    process.exitCode = exitCode;
    vi.restoreAllMocks();
  });

  it('returns the arguments of a command that may run and prints nothing', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    expect(readCLI(SPEC, ['in.txt'])?.positionals).toEqual(['in.txt']);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });

  it('prints the help to the standard output with exit code 0', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    expect(readCLI(SPEC, ['-h'])).toBeUndefined();
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Usage: pnpm demo:run'));
    expect(process.exitCode).toBe(0);
  });

  it('prints the mistakes to the error output with exit code 1', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    expect(readCLI(SPEC, [])).toBeUndefined();
    expect(stderr).toHaveBeenCalledWith(`Missing argument <file>.\n${HINT}\n`);
    expect(process.exitCode).toBe(1);
  });
});
