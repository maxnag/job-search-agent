import { describe, expect, it } from 'vitest';

import { countryFromLocation } from './location-country.helper.js';

describe('countryFromLocation', () => {
  it.each([
    ['Tel Aviv-Yafo', 'IL'],
    ["Ra'anana, Center District", 'IL'],
    ['Be’er Sheva', 'IL'],
    ['HAIFA', 'IL'],
    ['Remote — Israel', 'IL'],
    ['Kyiv, Ukraine', 'UA'],
    ['Ivano-Frankivsk', 'UA']
  ])('reads the country of %j', (location, country) => {
    expect(countryFromLocation(location, ['IL', 'UA'])).toBe(country);
  });

  it('matches whole words only', () => {
    expect(countryFromLocation('Holonville, TX', ['IL'])).toBeNull();
  });

  it('looks only for the countries asked', () => {
    expect(countryFromLocation('Kyiv', ['IL'])).toBeNull();
  });

  it('knows a country by its English name even without its cities', () => {
    expect(countryFromLocation('Warsaw, Poland', ['PL'])).toBe('PL');
  });

  it('gives the first country asked when the location names two', () => {
    expect(countryFromLocation('Haifa or Lviv', ['UA', 'IL'])).toBe('UA');
  });

  it.each([null, '', 'Anywhere', 'New York, NY'])('gives null for %j', location => {
    expect(countryFromLocation(location, ['IL', 'UA'])).toBeNull();
  });

  it('ignores a code with no English name', () => {
    expect(countryFromLocation('Somewhere', ['QX'])).toBeNull();
  });
});
