import { describe, expect, it } from 'vitest';

import { clipNullable, clipText } from './vacancy-fields.helper.js';

describe('clipText', () => {
  it('leaves a text within the limit alone, the limit itself included', () => {
    expect(clipText('Developer', 9)).toBe('Developer');
  });

  it('cuts a longer text to the limit, ellipsis included', () => {
    const clipped = clipText('Senior Backend Developer', 10);

    expect(clipped).toBe('Senior Ba…');
    expect(clipped).toHaveLength(10);
  });

  it('drops the spaces before the ellipsis', () => {
    expect(clipText('Senior    Backend', 9)).toBe('Senior…');
  });
});

describe('clipNullable', () => {
  it('keeps null', () => {
    expect(clipNullable(null, 5)).toBeNull();
  });

  it('clips a text', () => {
    expect(clipNullable('Tel Aviv-Yafo', 5)).toBe('Tel…');
  });
});
