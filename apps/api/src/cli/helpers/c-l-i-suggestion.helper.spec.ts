import { describe, expect, it } from 'vitest';

import { closestWord, editDistance, shellCommand } from './c-l-i-suggestion.helper.js';

describe('editDistance', () => {
  it.each([
    ['a missing letter', 'source', 'sorce', 1],
    ['an extra letter', 'skiped', 'skipped', 1],
    ['a replaced letter', 'force', 'forse', 1],
    ['two neighbours swapped', 'fit', 'fti', 1],
    ['equal words', 'stage', 'stage', 0],
    ['an empty word', 'abc', '', 3],
    ['unrelated words', 'abc', 'xyz', 3]
  ])('counts %s, either way round', (_case, typed, known, distance) => {
    expect(editDistance(typed, known)).toBe(distance);
    expect(editDistance(known, typed)).toBe(distance);
  });
});

describe('closestWord', () => {
  const options = ['source', 'stage', 'verdict', 'dry-run'];

  it.each([
    ['a missing letter', 'sorce', options, 'source'],
    ['an extra letter', 'skiped', ['listed', 'skipped', 'closed'], 'skipped'],
    ['swapped letters', 'fti', ['fit', 'almost', 'no_fit'], 'fit'],
    ['a missing dash', 'dryrun', options, 'dry-run'],
    ['another case', 'FIT', ['fit', 'almost', 'no_fit'], 'fit'],
    ['two edits in a long word', 'stagexx', options, 'stage']
  ])('suggests the candidate for %s', (_case, word, candidates, expected) => {
    expect(closestWord(word, candidates)).toBe(expected);
  });

  it.each([
    ['a one-letter word', 'x', options],
    ['three edits away', 'stagexxx', options],
    ['two edits in a short word', 'stg', options],
    ['an unrelated word', 'banana', options],
    ['two equally close candidates', 'stave', ['stage', 'stake']],
    ['no candidates', 'source', []]
  ])('suggests nothing for %s', (_case, word, candidates) => {
    expect(closestWord(word, candidates)).toBeUndefined();
  });
});

describe('shellCommand', () => {
  it('keeps plain words and quotes the ones the shell would split or read', () => {
    expect(shellCommand(['pnpm', 'vacancies:report', '--source', '7', '--title', 'senior dev', '--reason=100%'])).toBe(
      "pnpm vacancies:report --source 7 --title 'senior dev' --reason=100%"
    );
  });

  it('escapes a single quote inside a quoted word', () => {
    expect(shellCommand(['--title', "it's"])).toBe(`--title 'it'\\''s'`);
  });
});
