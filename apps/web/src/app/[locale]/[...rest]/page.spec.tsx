import { describe, expect, it } from 'vitest';

import CatchAllPage from './page';

describe('CatchAllPage', () => {
  it('answers "not found" for an address no page has', () => {
    expect(() => CatchAllPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});
