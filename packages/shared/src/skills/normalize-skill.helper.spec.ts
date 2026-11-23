import { describe, expect, it } from 'vitest';

import { findSkillByKey, normalizeSkill } from './normalize-skill.helper.js';
import { SkillKindEnum } from './skill-kind.enum.js';
import { SKILL_DICTIONARY } from './skill.dictionary.js';

describe('normalizeSkill', () => {
  it.each(['Node', 'NodeJS', 'Node.js', 'node js', 'NODE.JS'])('maps the spelling %s onto nodejs', name => {
    expect(normalizeSkill(name)).toMatchObject({ key: 'nodejs', name: 'Node.js', kind: SkillKindEnum.FRAMEWORK, isUnknown: false });
  });

  it.each([
    ['Angular 17', 'angular'],
    ['PHP 8.2', 'php'],
    ['Vue v3', 'vue'],
    ['Angular2+', 'angular'],
    ['Go 1.22', 'go']
  ])('drops the trailing version word of %s', (name, key) => {
    expect(normalizeSkill(name).key).toBe(key);
  });

  it('keeps a version-only name as it is, not as an empty key', () => {
    expect(normalizeSkill('2026').key).toBe('2026');
  });

  it.each([
    ['C#', 'csharp'],
    ['C++', 'cpp'],
    ['C', 'c']
  ])('does not mix %s with its neighbours', (name, key) => {
    expect(normalizeSkill(name).key).toBe(key);
  });

  it('keeps AngularJS apart from Angular', () => {
    expect(normalizeSkill('AngularJS').key).toBe('angularjs');
    expect(normalizeSkill('Angular').key).toBe('angular');
  });

  it('returns the implied skills of a known one', () => {
    expect(normalizeSkill('TypeScript').implies).toEqual(['javascript']);
    expect(normalizeSkill('PHP').implies).toEqual([]);
  });

  it('turns an unknown name into a slug and flags it', () => {
    expect(normalizeSkill('  Quantum -- Widgets!! ')).toEqual({
      key: 'quantum-widgets',
      name: 'Quantum -- Widgets!!',
      isUnknown: true,
      implies: []
    });
  });

  it('keeps # and + in the slug of an unknown name', () => {
    expect(normalizeSkill('F#').key).toBe('f#');
  });
});

describe('findSkillByKey', () => {
  it('finds a skill by its canonical key', () => {
    expect(findSkillByKey('javascript')?.name).toBe('JavaScript');
  });

  it('returns undefined for an unknown key', () => {
    expect(findSkillByKey('cobol')).toBeUndefined();
  });
});

describe('SKILL_DICTIONARY', () => {
  it('has unique keys', () => {
    const keys = SKILL_DICTIONARY.map(skill => skill.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('implies only skills it knows', () => {
    const implied = SKILL_DICTIONARY.flatMap(skill => skill.implies ?? []);

    expect(implied.every(key => findSkillByKey(key) !== undefined)).toBe(true);
  });
});
