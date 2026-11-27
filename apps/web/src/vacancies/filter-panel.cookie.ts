/**
 * Name of the cookie that remembers whether the filters of the list are open — on a phone and on a wide screen apart.
 * Prefixed with the project: the projects on `localhost` share the cookies of the host
 *
 * @type {string}
 */
export const FILTER_PANEL_COOKIE = 'jsa-filters-open';

/**
 * How long the cookie lives, in seconds — a year
 *
 * @type {number}
 */
export const FILTER_PANEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Kinds of device the cookie keeps a state for
 *
 * @type {readonly ['phone', 'desktop']}
 */
const DEVICES = ['phone', 'desktop'] as const;

/**
 * Read the cookie: `phone:0|desktop:1` (no comma — a cookie value may not hold one) — a device without a value has none
 *
 * @param {string | undefined} value
 *
 * @returns {Partial<Record<'phone' | 'desktop', boolean>>}
 */
export function parseFilterPanelCookie(value: string | undefined): Partial<Record<'phone' | 'desktop', boolean>> {
  const states: Partial<Record<'phone' | 'desktop', boolean>> = {};

  for (const entry of (value ?? '').split('|')) {
    const [device, state] = entry.split(':');
    const known = DEVICES.find(name => name === device);

    if (known && (state === '0' || state === '1')) {
      states[known] = state === '1';
    }
  }

  return states;
}

/**
 * Write the cookie back with one device changed, the other kept
 *
 * @param {string | undefined} value The cookie now
 * @param {'phone' | 'desktop'} device
 * @param {boolean} opened
 *
 * @returns {string}
 */
export function serializeFilterPanelCookie(value: string | undefined, device: 'phone' | 'desktop', opened: boolean): string {
  const states = { ...parseFilterPanelCookie(value), [device]: opened };

  return DEVICES.flatMap(name => (states[name] === undefined ? [] : [`${name}:${states[name] ? 1 : 0}`])).join('|');
}
