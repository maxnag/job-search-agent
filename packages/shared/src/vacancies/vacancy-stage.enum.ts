/**
 * Stage of a vacancy: `listed` — seen on a listing page, waiting for extraction; `skipped` — dropped by title or place
 * before extraction; `extracted` — its page parsed and matched; `closed` — gone from the listing page
 */
export enum VacancyStageEnum {
  LISTED = 'listed',
  SKIPPED = 'skipped',
  EXTRACTED = 'extracted',
  CLOSED = 'closed'
}
