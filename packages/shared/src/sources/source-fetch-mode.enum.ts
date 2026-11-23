/**
 * How the listing page of a source is loaded: a plain request, or rendered in a headless browser for lists drawn by
 * JavaScript
 */
export enum SourceFetchModeEnum {
  HTML = 'html',
  RENDERED = 'rendered'
}
