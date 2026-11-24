/**
 * Query parameters that only track the reader — dropped from every link of a job mail
 *
 * @type {RegExp}
 */
const TRACKING_PARAM =
  /^(utm_.*|ss|trk|trkinfo|trackingid|refid|lipi|midtoken|midsig|eid|otptoken|mc_cid|mc_eid|gclid|fbclid|_hsenc|_hsmi)$/i;

/**
 * Text of a link that serves the subscription, not a vacancy — narrow on purpose: a link dropped by mistake is a lost
 * vacancy, one kept by mistake costs only a line the LLM skips
 *
 * @type {readonly RegExp[]}
 */
const SERVICE_TEXT: readonly RegExp[] = [
  /unsubscri|manage (my )?(job )?alerts|alert settings|e-?mail preferences/i,
  /privacy policy|terms of (use|service)|(view|see) all jobs|^(sign|log) ?in$/i
];

/**
 * Path of a link that serves the subscription
 *
 * @type {RegExp}
 */
const SERVICE_PATH = /unsubscri|\/subscriptions?(\/|$)|\/preferences(\/|$)|\/settings(\/|$)/i;

/**
 * Query parameters a redirect wrapper keeps the real address in
 *
 * @type {readonly string[]}
 */
const REDIRECT_PARAMS: readonly string[] = ['url', 'u', 'target', 'redirect', 'redirect_url', 'dest', 'destination', 'link', 'goto'];

/**
 * Protocols of a link to a page
 *
 * @type {ReadonlySet<string>}
 */
const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * The address a redirect wrapper leads to, when it names one in its query; the link itself otherwise
 *
 * @param {URL} url
 *
 * @returns {URL}
 */
export function unwrapRedirect(url: URL): URL {
  for (const name of REDIRECT_PARAMS) {
    const target = URL.parse(url.searchParams.get(name) ?? '');

    if (target && WEB_PROTOCOLS.has(target.protocol)) {
      return target;
    }
  }

  return url;
}

/**
 * The link without the query parameters that only track the reader, and without the fragment
 *
 * @param {URL} url
 *
 * @returns {string}
 */
export function withoutTracking(url: URL): string {
  const clean = new URL(url.href);

  clean.hash = '';

  for (const name of [...clean.searchParams.keys()]) {
    if (TRACKING_PARAM.test(name)) {
      clean.searchParams.delete(name);
    }
  }

  return clean.href;
}

/**
 * True for a link that serves the subscription — unsubscribe, settings, sign in — by its text or its path
 *
 * @param {URL} url
 * @param {string} text
 *
 * @returns {boolean}
 */
export function isServiceLink(url: URL, text: string): boolean {
  const label = text.trim();

  return SERVICE_TEXT.some(pattern => pattern.test(label)) || SERVICE_PATH.test(url.pathname);
}

/**
 * True when the host is the domain or one of its subdomains
 *
 * @param {string} host
 * @param {string} domain
 *
 * @returns {boolean}
 */
export function isHostOf(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}
