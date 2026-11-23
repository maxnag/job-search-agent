import { describe, expect, it } from 'vitest';

import type { IResumeParser } from '../interfaces/resume-parser.interface.js';
import { ResumeParserRegistry } from './resume-parser.registry.js';

const parser = (extensions: readonly string[]): IResumeParser => ({ extensions, parse: () => Promise.resolve('text') });

describe('ResumeParserRegistry', () => {
  it('finds the parser of an extension, whatever its case', () => {
    const pdf = parser(['.pdf']);

    expect(new ResumeParserRegistry([pdf]).findOne('CV.PDF')).toBe(pdf);
  });

  it('names the supported formats for an unknown one', () => {
    expect(() => new ResumeParserRegistry([parser(['.pdf'])]).findOne('cv.docx')).toThrow(
      'RESUME_FORMAT_UNSUPPORTED: ".docx" — supported: .pdf'
    );
  });

  it('names the file when it has no extension', () => {
    expect(() => new ResumeParserRegistry([parser(['.pdf'])]).findOne('resume')).toThrow('RESUME_FORMAT_UNSUPPORTED: "resume"');
  });

  it('refuses two parsers of one extension', () => {
    expect(() => new ResumeParserRegistry([parser(['.pdf']), parser(['.pdf'])])).toThrow('RESUME_PARSER_DUPLICATE: .pdf');
  });
});
