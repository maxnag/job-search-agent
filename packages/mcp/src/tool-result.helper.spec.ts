import { describe, expect, it } from 'vitest';

import { toolError, toolResult } from './tool-result.helper.js';

describe('toolResult', () => {
  it('gives the data as structured content and as JSON after the summary', () => {
    expect(toolResult({ total: 1, rows: [{ id: 7 }] }, '1 of 1 rows')).toEqual({
      content: [{ type: 'text', text: '1 of 1 rows\n\n{"total":1,"rows":[{"id":7}]}' }],
      structuredContent: { total: 1, rows: [{ id: 7 }] }
    });
  });

  it('is never an error', () => {
    expect(toolResult({}, 'nothing').isError).toBeUndefined();
  });
});

describe('toolError', () => {
  it('starts the text with the code and carries no structured content', () => {
    expect(toolError('VACANCY_NOT_FOUND', 'There is no vacancy 999')).toEqual({
      content: [{ type: 'text', text: 'VACANCY_NOT_FOUND: There is no vacancy 999' }],
      isError: true
    });
  });
});
