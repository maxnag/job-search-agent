import { describe, expect, it } from 'vitest';

import { scriptJSON } from './script-json.helper.js';

describe('scriptJSON', () => {
  it('reads an object assigned in a script', () => {
    const html = '<script>var COMPANY_DATA = {"name":"Fabrikam","size":12};</script>';

    expect(scriptJSON(html, 'COMPANY_DATA')).toEqual({ name: 'Fabrikam', size: 12 });
  });

  it('reads an array with nested values', () => {
    const html = '<script>window.POSITIONS=[{"uid":"A1","tags":["a",{"b":[1,2]}]}]; other();</script>';

    expect(scriptJSON(html, 'POSITIONS')).toEqual([{ uid: 'A1', tags: ['a', { b: [1, 2] }] }]);
  });

  it('is not fooled by brackets and escaped quotes inside strings', () => {
    const html = String.raw`<script>DATA = {"text":"a } ] \" [ {","n":1};</script>`;

    expect(scriptJSON(html, 'DATA')).toEqual({ text: 'a } ] " [ {', n: 1 });
  });

  it('matches the whole name only', () => {
    const html = '<script>MY_DATA = {"a":1}; DATA = {"b":2};</script>';

    expect(scriptJSON(html, 'DATA')).toEqual({ b: 2 });
  });

  it('gives undefined when the name is not assigned an object or an array', () => {
    expect(scriptJSON('<script>DATA = "text";</script>', 'DATA')).toBeUndefined();
    expect(scriptJSON('<p>no script</p>', 'DATA')).toBeUndefined();
  });

  it('gives undefined for a value that never closes', () => {
    expect(scriptJSON('<script>DATA = {"a":[1,2</script>', 'DATA')).toBeUndefined();
  });

  it('gives undefined for a value that is not JSON', () => {
    expect(scriptJSON("<script>DATA = {a: 'b'};</script>", 'DATA')).toBeUndefined();
  });
});
