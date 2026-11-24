/**
 * How the extraction of a vacancy ended; `no_text` — a vacancy of a site the crawler never opens, not found on a board
 * of its company: nothing to read yet
 */
export enum VacancyExtractionOutcomeEnum {
  EXTRACTED = 'extracted',
  CHANGED = 'changed',
  UNCHANGED = 'unchanged',
  CLOSED = 'closed',
  SKIPPED = 'skipped',
  NO_TEXT = 'no_text'
}
