import { describe, expect, it, vi } from 'vitest';

import { formatCLIHelp } from './c-l-i-help.helper.js';
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
    { name: 'profile', value: 'name', description: 'Profile', required: true },
    { name: 'stage', short: 's', value: 'stage', description: 'Stage', multiple: true, choices: ['listed', 'closed'] },
    { name: 'dry-run', description: 'Store nothing' }
  ],
  examples: [{ args: 'cv.pdf --profile dev', description: 'Import a file' }],
  notes: ['Needs the API.']
};

describe('formatCLIHelp', () => {
  it('prints the usage, the summary, aligned arguments and options, examples and notes', () => {
    expect(formatCLIHelp(SPEC)).toBe(
      [
        'Usage: pnpm demo:run <file> --profile <name> [options]',
        '',
        'Run the demo.',
        '',
        'Arguments:',
        '  <file>  Input file',
        '',
        'Options:',
        '      --profile <name>  Profile (required)',
        '  -s, --stage <stage>   Stage (one of: listed, closed; repeatable)',
        '      --dry-run         Store nothing',
        '  -h, --help            Show this help',
        '',
        'Examples:',
        '  pnpm demo:run cv.pdf --profile dev',
        '    Import a file',
        '',
        'Notes:',
        '  Needs the API.',
        ''
      ].join('\n')
    );
  });

  it('leaves out the sections a command has nothing for and shows an optional argument in brackets', () => {
    const help = formatCLIHelp({
      command: 'demo:list',
      summary: 'List.',
      arguments: [{ name: 'url', description: 'Page' }],
      examples: [{ args: '', description: 'List everything' }]
    });

    expect(help).toContain('Usage: pnpm demo:list [<url>] [options]\n');
    expect(help).toContain('Options:\n  -h, --help  Show this help\n');
    expect(help).toContain('  pnpm demo:list\n    List everything\n');
    expect(help).not.toContain('Notes:');
  });
});
