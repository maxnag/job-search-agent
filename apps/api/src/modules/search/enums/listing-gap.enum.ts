/**
 * Why a scan did not see the whole listing — a listing with a gap closes nothing
 */
export enum ListingGapEnum {
  PAGINATION = 'pagination',
  LINK_LIMIT = 'link_limit',
  SCROLL_LIMIT = 'scroll_limit'
}
