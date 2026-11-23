/**
 * Elements a reader of the page does not see — the usual place to hide text meant for a model, not a person. They are
 * replaced with a space, not removed: a hidden separator between two words must not glue them. CSS classes that hide
 * an element are not recognized
 *
 * @type {string}
 */
export const HIDDEN_CONTENT = [
  '[hidden]',
  '[aria-hidden="true"]',
  '[style*="display:none" i]',
  '[style*="display: none" i]',
  '[style*="visibility:hidden" i]',
  '[style*="visibility: hidden" i]'
].join(', ');
