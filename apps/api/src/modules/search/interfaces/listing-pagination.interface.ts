/**
 * Pagination found on a listing page — more positions are on pages the scan did not read
 */
export interface IListingPagination {
  /**
   * Address of the next page; absent for a "Load more" button, which only a browser can follow
   *
   * @var {string}
   */
  readonly nextURL?: string;
}
