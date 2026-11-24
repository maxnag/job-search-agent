/**
 * Cities a location may name without its country, by ISO 3166-1 alpha-2 code — the countries the project searches
 *
 * @type {Readonly<Record<string, readonly string[]>>}
 */
const COUNTRY_CITIES: Readonly<Record<string, readonly string[]>> = {
  IL: [
    'tel aviv',
    'herzliya',
    'haifa',
    'jerusalem',
    'petah tikva',
    'petach tikva',
    'ramat gan',
    'raanana',
    'ra anana',
    'netanya',
    'rehovot',
    'yokneam',
    'kfar saba',
    'hod hasharon',
    'rosh haayin',
    'rosh ha ayin',
    'beer sheva',
    'be er sheva',
    'beersheba',
    'caesarea',
    'airport city',
    'modiin',
    'holon',
    'bnei brak',
    'givatayim',
    'or yehuda',
    'ashdod',
    'ashkelon',
    'rishon lezion',
    'nazareth',
    'kiryat gat',
    'migdal haemek'
  ],
  UA: [
    'kyiv',
    'kiev',
    'lviv',
    'kharkiv',
    'odesa',
    'odessa',
    'dnipro',
    'zaporizhzhia',
    'vinnytsia',
    'ivano frankivsk',
    'chernivtsi',
    'ternopil'
  ]
};

/**
 * English country names by ISO 3166-1 alpha-2 code
 *
 * @type {Intl.DisplayNames}
 */
const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * The country a location written by a company names, among the given ones — by the country's English name or one of
 * its cities, matched as whole words; null when it names none of them. A board without a country field is read this
 * way by the discovery, so a position in another country is never taken for a wanted one
 *
 * @param {string | null} location
 * @param {readonly string[]} countries ISO 3166-1 alpha-2 codes to look for
 *
 * @returns {string | null}
 */
export function countryFromLocation(location: string | null, countries: readonly string[]): string | null {
  if (!location) {
    return null;
  }

  const text = ` ${phrase(location)} `;

  return countries.find(code => placeNames(code).some(name => text.includes(` ${name} `))) ?? null;
}

/**
 * The country name and the cities of a country, normalized
 *
 * @param {string} code
 *
 * @returns {string[]}
 */
function placeNames(code: string): string[] {
  const names = [...(COUNTRY_CITIES[code] ?? [])];

  try {
    const country = COUNTRY_NAMES.of(code);

    if (country && country !== code) {
      names.push(phrase(country));
    }
  } catch {
    return names;
  }

  return names;
}

/**
 * Lower case, letters and digits of any script, single spaces
 *
 * @param {string} text
 *
 * @returns {string}
 */
function phrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
