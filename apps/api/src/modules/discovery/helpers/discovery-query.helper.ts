import { RoleFamilyEnum, WorkModeEnum } from '@job-agent/shared';

import type { IProfilePreferencesEntry } from '../../search/interfaces/profile-preferences-entry.interface.js';

/**
 * Pages of the boards a query searches, one per applicant tracking system
 *
 * @type {readonly string[]}
 */
export const ATS_BOARD_SITES: readonly string[] = ['comeet.com/jobs', 'job-boards.greenhouse.io', 'jobs.lever.co'];

/**
 * Words a board title of a role family is found by; null for the families a search would not find well
 *
 * @type {Readonly<Record<RoleFamilyEnum, string | null>>}
 */
const ROLE_WORDS: Readonly<Record<RoleFamilyEnum, string | null>> = {
  [RoleFamilyEnum.FULL_STACK]: 'full stack',
  [RoleFamilyEnum.BACKEND]: 'backend',
  [RoleFamilyEnum.FRONTEND]: 'frontend',
  [RoleFamilyEnum.SOFTWARE_ENGINEER]: 'software engineer',
  [RoleFamilyEnum.AI_ENGINEER]: 'AI engineer',
  [RoleFamilyEnum.TEAM_LEAD]: 'team lead',
  [RoleFamilyEnum.ARCHITECT]: 'architect',
  [RoleFamilyEnum.ENGINEERING_MANAGER]: 'engineering manager',
  [RoleFamilyEnum.DEVOPS]: 'devops',
  [RoleFamilyEnum.QA]: 'QA',
  [RoleFamilyEnum.DATA]: 'data engineer',
  [RoleFamilyEnum.MOBILE]: 'mobile',
  [RoleFamilyEnum.OTHER]: null
};

/**
 * English country names by ISO 3166-1 alpha-2 code
 *
 * @type {Intl.DisplayNames}
 */
const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * A place a query searches: the country name and whether only remote work is wanted there
 */
interface IQueryPlace {
  /**
   * Country name in English
   *
   * @var {string}
   */
  readonly country: string;

  /**
   * True when every profile wants only remote work in the country
   *
   * @var {boolean}
   */
  readonly remoteOnly: boolean;
}

/**
 * Web search queries that find boards with positions the profiles want: every board site × every country of the
 * profiles (`remote` added where only remote work is wanted) × every searched role family, at most `maxQueries`
 *
 * @param {readonly IProfilePreferencesEntry[]} profiles
 * @param {number} maxQueries
 *
 * @returns {string[]}
 */
export function buildDiscoveryQueries(profiles: readonly IProfilePreferencesEntry[], maxQueries: number): string[] {
  const roles = [...new Set(profiles.flatMap(profile => profile.preferences.role_families))]
    .map(family => ROLE_WORDS[family])
    .filter(words => words !== null);
  const queries: string[] = [];

  for (const place of queryPlaces(profiles)) {
    for (const role of roles) {
      for (const site of ATS_BOARD_SITES) {
        const remote = place.remoteOnly ? ' remote' : '';

        queries.push(`site:${site} ${place.country}${remote} "${role}"`);
      }
    }
  }

  return queries.slice(0, maxQueries);
}

/**
 * Countries of the profiles, each with its remote-only mark
 *
 * @param {readonly IProfilePreferencesEntry[]} profiles
 *
 * @returns {IQueryPlace[]}
 */
function queryPlaces(profiles: readonly IProfilePreferencesEntry[]): IQueryPlace[] {
  const modes = new Map<string, Set<WorkModeEnum>>();

  for (const place of profiles.flatMap(profile => profile.preferences.places)) {
    const known = modes.get(place.country) ?? new Set<WorkModeEnum>();

    place.work_modes.forEach(mode => known.add(mode));
    modes.set(place.country, known);
  }

  return [...modes].flatMap(([code, workModes]) => {
    const country = countryName(code);

    if (!country || country === code) {
      return [];
    }

    return [{ country, remoteOnly: workModes.size === 1 && workModes.has(WorkModeEnum.REMOTE) }];
  });
}

/**
 * English name of a country code, `undefined` when the code names no region
 *
 * @param {string} code
 *
 * @returns {string | undefined}
 */
function countryName(code: string): string | undefined {
  try {
    return COUNTRY_NAMES.of(code);
  } catch {
    return undefined;
  }
}
