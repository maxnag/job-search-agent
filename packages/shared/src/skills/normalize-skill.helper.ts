import type { INormalizedSkill, ISkillDefinition } from './skill-definition.interface.js';
import { SKILL_DICTIONARY } from './skill.dictionary.js';

/**
 * A word that is only a version: `17`, `8.2`, `v3`, `2+`
 *
 * @type {RegExp}
 */
const VERSION_WORD = /^v?\d[\d.]*\+?$/;

/**
 * Separators that differ between spellings of one name: `Node.js`, `node js`, `node-js`
 *
 * @type {RegExp}
 */
const SEPARATORS = /[\s._-]+/g;

/**
 * Characters a slug of an unknown skill drops; `#` and `+` stay — `C#` and `C++` are not `C`
 *
 * @type {RegExp}
 */
const SLUG_DROPPED = /[^a-z0-9#+]+/g;

/**
 * Lower-cased name without surrounding spaces and a trailing version word (`Angular 17` → `angular`)
 *
 * @param {string} name
 *
 * @returns {string}
 */
function clean(name: string): string {
  const words = name.trim().toLowerCase().split(' ').filter(Boolean);
  const last = words.at(-1);

  if (words.length > 1 && last !== undefined && VERSION_WORD.test(last)) {
    words.pop();
  }

  return words.join(' ');
}

/**
 * Name with the separators removed
 *
 * @param {string} name
 *
 * @returns {string}
 */
function compact(name: string): string {
  return clean(name).replace(SEPARATORS, '');
}

/**
 * Add one spelling to the index, refusing a spelling two skills share
 *
 * @param {Map<string, ISkillDefinition>} index
 * @param {string} spelling
 * @param {ISkillDefinition} skill
 *
 * @throws {Error} `SKILL_DICTIONARY_COLLISION` if the spelling already belongs to another skill
 *
 * @returns {void}
 */
function addSpelling(index: Map<string, ISkillDefinition>, spelling: string, skill: ISkillDefinition): void {
  const owner = index.get(spelling);

  if (owner && owner.key !== skill.key) {
    throw new Error(`SKILL_DICTIONARY_COLLISION: "${spelling}" belongs to both ${owner.key} and ${skill.key}`);
  }

  index.set(spelling, skill);
}

/**
 * Index of every spelling of every skill: the exact lower-cased form and the form without separators
 *
 * @throws {Error} `SKILL_DICTIONARY_COLLISION` if two skills share a spelling
 *
 * @returns {ReadonlyMap<string, ISkillDefinition>}
 */
function buildIndex(): ReadonlyMap<string, ISkillDefinition> {
  const index = new Map<string, ISkillDefinition>();

  for (const skill of SKILL_DICTIONARY) {
    for (const spelling of [skill.key, skill.name, ...skill.aliases]) {
      addSpelling(index, clean(spelling), skill);
      addSpelling(index, compact(spelling), skill);
    }
  }

  return index;
}

/**
 * Every skill by its canonical key, with each `implies` checked to name a known skill
 *
 * @throws {Error} `SKILL_DICTIONARY_UNKNOWN_IMPLIED` if a skill implies a key the dictionary lacks
 *
 * @returns {ReadonlyMap<string, ISkillDefinition>}
 */
function buildKeyIndex(): ReadonlyMap<string, ISkillDefinition> {
  const byKey = new Map(SKILL_DICTIONARY.map(skill => [skill.key, skill]));

  for (const skill of SKILL_DICTIONARY) {
    const unknown = (skill.implies ?? []).filter(key => !byKey.has(key));

    if (unknown.length > 0) {
      throw new Error(`SKILL_DICTIONARY_UNKNOWN_IMPLIED: ${skill.key} implies unknown ${unknown.join(', ')}`);
    }
  }

  return byKey;
}

/**
 * Skills by canonical key, built once per process
 *
 * @type {ReadonlyMap<string, ISkillDefinition>}
 */
const SKILL_BY_KEY: ReadonlyMap<string, ISkillDefinition> = buildKeyIndex();

/**
 * A skill of the dictionary by its canonical key
 *
 * @param {string} key
 *
 * @returns {ISkillDefinition | undefined}
 */
export function findSkillByKey(key: string): ISkillDefinition | undefined {
  return SKILL_BY_KEY.get(key);
}

/**
 * Lookup table built once per process
 *
 * @type {ReadonlyMap<string, ISkillDefinition>}
 */
const SKILL_INDEX: ReadonlyMap<string, ISkillDefinition> = buildIndex();

/**
 * Map a skill name as written onto the dictionary: `Node`, `NodeJS` and `Node.js` all become `nodejs`.
 * An unknown name gets a slug key and the flag `isUnknown`
 *
 * @param {string} name
 *
 * @returns {INormalizedSkill}
 */
export function normalizeSkill(name: string): INormalizedSkill {
  const known = SKILL_INDEX.get(clean(name)) ?? SKILL_INDEX.get(compact(name));

  if (known) {
    return { key: known.key, name: known.name, kind: known.kind, isUnknown: false, implies: known.implies ?? [] };
  }

  const slug = clean(name).replace(SLUG_DROPPED, '-').split('-').filter(Boolean).join('-');

  return { key: slug, name: name.trim(), isUnknown: true, implies: [] };
}
