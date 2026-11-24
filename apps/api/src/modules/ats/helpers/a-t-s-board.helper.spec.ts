import { describe, expect, it } from 'vitest';

import { ATSKindEnum } from '@job-agent/shared';

import { boardIdentity, boardURL, parseATSBoard } from './a-t-s-board.helper.js';

describe('parseATSBoard', () => {
  it.each([
    ['https://job-boards.greenhouse.io/northwind', 'northwind'],
    ['https://job-boards.greenhouse.io/Northwind/jobs/4012345', 'northwind'],
    ['https://boards.greenhouse.io/northwind?gh_src=feed', 'northwind'],
    ['https://job-boards.greenhouse.io/embed/job_board?for=northwind', 'northwind']
  ])('reads the Greenhouse board of %s', (url, board) => {
    expect(parseATSBoard(url)).toEqual({ kind: ATSKindEnum.GREENHOUSE, board });
  });

  it.each([
    'https://job-boards.greenhouse.io/',
    'https://job-boards.greenhouse.io/v1/boards',
    'https://job-boards.greenhouse.io/embed/job_board'
  ])('finds no board in the Greenhouse page %s', url => {
    expect(parseATSBoard(url)).toBeUndefined();
  });

  it('reads the Lever board and keeps its case', () => {
    expect(parseATSBoard('https://jobs.lever.co/Contoso/1c2d3e4f-0000-4000-8000-000000000001')).toEqual({
      kind: ATSKindEnum.LEVER,
      board: 'Contoso'
    });
  });

  it.each([
    ['https://www.comeet.com/jobs/fabrikam/a1.00b', 'fabrikam/A1.00B'],
    ['https://comeet.co/jobs/fabrikam/A1.00B/backend-engineer/C2.D41', 'fabrikam/A1.00B']
  ])('reads the Comeet board of %s with the uid in upper case', (url, board) => {
    expect(parseATSBoard(url)).toEqual({ kind: ATSKindEnum.COMEET, board });
  });

  it.each([
    'https://www.comeet.com/careers/fabrikam/A1.00B',
    'https://www.comeet.com/jobs/fabrikam',
    'https://www.comeet.com/jobs/fabrikam/not-a-uid'
  ])('finds no board in the Comeet link %s', url => {
    expect(parseATSBoard(url)).toBeUndefined();
  });

  it.each([
    'file:///job-boards.greenhouse.io/northwind',
    'https://careers.northwind.example/jobs',
    'not a link',
    'https://jobs.lever.co/-bad',
    `https://jobs.lever.co/${'a'.repeat(101)}`
  ])('finds no board in %s', url => {
    expect(parseATSBoard(url)).toBeUndefined();
  });
});

describe('boardIdentity', () => {
  it('tells a Comeet board by its company uid only', () => {
    const first = boardIdentity({ kind: ATSKindEnum.COMEET, board: 'fabrikam/A1.00B' });
    const second = boardIdentity({ kind: ATSKindEnum.COMEET, board: 'fabrikam-labs/a1.00b' });

    expect(first).toBe('comeet:A1.00B');
    expect(second).toBe(first);
  });

  it('tells other boards by kind and name', () => {
    expect(boardIdentity({ kind: ATSKindEnum.LEVER, board: 'Contoso' })).toBe('lever:Contoso');
  });
});

describe('boardURL', () => {
  it.each([
    [ATSKindEnum.GREENHOUSE, 'northwind', 'https://job-boards.greenhouse.io/northwind'],
    [ATSKindEnum.LEVER, 'Contoso', 'https://jobs.lever.co/Contoso'],
    [ATSKindEnum.COMEET, 'fabrikam/A1.00B', 'https://www.comeet.com/jobs/fabrikam/A1.00B']
  ])('gives the canonical %s link', (kind, board, url) => {
    expect(boardURL({ kind, board })).toBe(url);
  });

  it('leads back to the same board', () => {
    const board = { kind: ATSKindEnum.COMEET, board: 'fabrikam/A1.00B' };

    expect(parseATSBoard(boardURL(board))).toEqual(board);
  });
});
