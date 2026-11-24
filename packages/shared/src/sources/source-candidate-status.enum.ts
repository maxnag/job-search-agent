/**
 * State of a company board found by the discovery: `proposed` — it has positions some profile searches for and the
 * owner got a card; `added` — the owner made it a source; `ignored` — the owner declined it for good; `empty` — no
 * position passed the screening, checked again later
 */
export enum SourceCandidateStatusEnum {
  PROPOSED = 'proposed',
  ADDED = 'added',
  IGNORED = 'ignored',
  EMPTY = 'empty'
}
