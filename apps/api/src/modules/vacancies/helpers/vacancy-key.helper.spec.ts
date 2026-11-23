import { describe, expect, it } from 'vitest';

import { normalizeCity, normalizeCompany, vacancyDedupKey } from './vacancy-key.helper.js';

describe('normalizeCompany', () => {
  it.each([
    ['Northwind Ltd', 'northwind'],
    ['Northwind Ltd.', 'northwind'],
    ['NORTHWIND, Inc.', 'northwind'],
    ['Northwind Software Co. Ltd', 'northwind software'],
    ['Contoso GmbH', 'contoso'],
    ['Fabrikam B.V.', 'fabrikam b v'],
    ['Tailspin Toys LLC', 'tailspin toys'],
    ['Adatum Corporation', 'adatum'],
    ['Litware B.M.', 'litware b m'],
    ['Litware BM', 'litware']
  ])('makes %j the key %j', (company, key) => {
    expect(normalizeCompany(company)).toBe(key);
  });

  it('keeps a name made only of a legal word', () => {
    expect(normalizeCompany('Corp')).toBe('corp');
  });

  it('keeps a legal word in the middle of a name', () => {
    expect(normalizeCompany('Inc Studio')).toBe('inc studio');
  });

  it('keeps letters of any script and digits', () => {
    expect(normalizeCompany('Київ Софт 24 ТОВ')).toBe('київ софт 24 тов');
  });

  it('gives an empty key for a name without letters or digits', () => {
    expect(normalizeCompany(' — ')).toBe('');
  });
});

describe('normalizeCity', () => {
  it.each([
    ["Be'er Sheva", 'beersheva'],
    ['Beer-Sheva', 'beersheva'],
    ['Tel Aviv-Yafo', 'telavivyafo'],
    ['  HERZLIYA ', 'herzliya']
  ])('writes %j as %j', (city, key) => {
    expect(normalizeCity(city)).toBe(key);
  });
});

describe('vacancyDedupKey', () => {
  it('joins the normalized company and title', () => {
    expect(vacancyDedupKey('Northwind Ltd', 'Senior  Backend Developer (Node.js)')).toBe('northwind|senior backend developer node js');
  });

  it('gives one key to the same position written differently', () => {
    expect(vacancyDedupKey('NORTHWIND INC.', 'senior backend developer - node.js')).toBe(
      vacancyDedupKey('Northwind', 'Senior Backend Developer (Node.js)')
    );
  });

  it('keeps different titles of one company apart', () => {
    expect(vacancyDedupKey('Northwind', 'Backend Developer')).not.toBe(vacancyDedupKey('Northwind', 'Frontend Developer'));
  });
});
