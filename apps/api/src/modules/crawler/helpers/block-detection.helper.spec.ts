import { describe, expect, it } from 'vitest';

import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';
import { detectBlock } from './block-detection.helper.js';

/**
 * A served page with the given changes
 *
 * @param {Partial<IFetchedPage>} changes
 *
 * @returns {IFetchedPage}
 */
function page(changes: Partial<IFetchedPage> = {}): IFetchedPage {
  return { url: 'https://careers.example.com/jobs', status: 200, headers: {}, html: '<html><body>Jobs</body></html>', ...changes };
}

describe('detectBlock', () => {
  it.each([403, 429])('names the refusal status %i', status => {
    expect(detectBlock(page({ status }))).toBe(`HTTP ${status}`);
  });

  it.each([200, 404, 500, 401])('leaves status %i to the caller', status => {
    expect(detectBlock(page({ status }))).toBeUndefined();
  });

  it('recognizes the Cloudflare challenge header', () => {
    expect(detectBlock(page({ headers: { 'cf-mitigated': 'challenge' } }))).toBe('Cloudflare challenge');
  });

  it('ignores another value of the Cloudflare header', () => {
    expect(detectBlock(page({ headers: { 'cf-mitigated': 'none' } }))).toBeUndefined();
  });

  it.each([
    ['<script>window._cf_chl_opt={}</script>', 'Cloudflare challenge'],
    ['<script src="https://ct.captcha-delivery.com/c.js"></script>', 'DataDome captcha'],
    ['<div id="px-captcha"></div>', 'PerimeterX captcha']
  ])('recognizes a challenge page by %s', (html, reason) => {
    expect(detectBlock(page({ html }))).toBe(reason);
  });

  it('does not take a reCAPTCHA of an application form for a challenge', () => {
    expect(detectBlock(page({ html: '<form><div class="g-recaptcha"></div></form>' }))).toBeUndefined();
  });

  it('puts the status before the markers', () => {
    expect(detectBlock(page({ status: 403, html: '<div id="px-captcha"></div>' }))).toBe('HTTP 403');
  });
});
