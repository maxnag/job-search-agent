import { describe, expect, it } from 'vitest';

import { FILTER_PANEL_COOKIE, parseFilterPanelCookie, serializeFilterPanelCookie } from './filter-panel.cookie';

describe('filter panel cookie', () => {
  it('carries the project prefix', () => {
    expect(FILTER_PANEL_COOKIE).toBe('jsa-filters-open');
  });

  describe('parseFilterPanelCookie', () => {
    it.each([
      ['both devices', 'phone:0|desktop:1', { phone: false, desktop: true }],
      ['one device', 'desktop:0', { desktop: false }],
      ['no cookie', undefined, {}],
      ['an unknown device or state, dropped', 'tablet:1|phone:yes|desktop:1', { desktop: true }],
      ['a value of another shape', 'garbage', {}]
    ])('reads %s', (_case, value, expected) => {
      expect(parseFilterPanelCookie(value)).toEqual(expected);
    });
  });

  describe('serializeFilterPanelCookie', () => {
    it('changes one device and keeps the other, without a comma', () => {
      expect(serializeFilterPanelCookie('desktop:0', 'phone', true)).toBe('phone:1|desktop:0');
      expect(serializeFilterPanelCookie('phone:1|desktop:0', 'desktop', true)).toBe('phone:1|desktop:1');
    });

    it('starts a cookie with one device', () => {
      expect(serializeFilterPanelCookie(undefined, 'desktop', false)).toBe('desktop:0');
    });
  });
});
