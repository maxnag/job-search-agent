/**
 * A browser installed in the system that Playwright drives instead of its own build — for a machine Playwright
 * publishes no build for
 */
export enum BrowserChannelEnum {
  CHROME = 'chrome',
  CHROME_BETA = 'chrome-beta',
  MSEDGE = 'msedge'
}
