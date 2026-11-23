import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PDFResumeParser } from './p-d-f-resume.parser.js';

const unpdf = vi.hoisted(() => ({ getDocumentProxy: vi.fn(), extractText: vi.fn() }));

vi.mock('unpdf', () => unpdf);

describe('PDFResumeParser (unit)', () => {
  let subjectUnderTest: PDFResumeParser;

  beforeEach(() => {
    vi.clearAllMocks();
    unpdf.getDocumentProxy.mockResolvedValue({});
    subjectUnderTest = new PDFResumeParser();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('reads PDF files', () => {
    expect(subjectUnderTest.extensions).toEqual(['.pdf']);
  });

  it('returns the text of every page, trimmed', async () => {
    unpdf.extractText.mockResolvedValue({
      totalPages: 2,
      text: '  Senior Developer with 10 years of TypeScript and PostgreSQL experience  '
    });

    await expect(subjectUnderTest.parse(Buffer.from('%PDF'))).resolves.toBe(
      'Senior Developer with 10 years of TypeScript and PostgreSQL experience'
    );
    expect(unpdf.extractText).toHaveBeenCalledWith({}, { mergePages: true });
  });

  it('refuses a PDF without a text layer', async () => {
    unpdf.extractText.mockResolvedValue({ totalPages: 1, text: '   ' });

    await expect(subjectUnderTest.parse(Buffer.from('%PDF'))).rejects.toThrow('RESUME_PDF_NO_TEXT');
  });

  it('treats a text shorter than 50 characters as missing', async () => {
    unpdf.extractText.mockResolvedValue({ totalPages: 1, text: 'x'.repeat(49) });

    await expect(subjectUnderTest.parse(Buffer.from('%PDF'))).rejects.toThrow('RESUME_PDF_NO_TEXT');
  });

  it('accepts a text of exactly 50 characters', async () => {
    unpdf.extractText.mockResolvedValue({ totalPages: 1, text: 'x'.repeat(50) });

    await expect(subjectUnderTest.parse(Buffer.from('%PDF'))).resolves.toHaveLength(50);
  });
});
