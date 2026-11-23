import { Injectable } from '@nestjs/common';
import { extractText, getDocumentProxy } from 'unpdf';

import type { IResumeParser } from '../interfaces/resume-parser.interface.js';

/**
 * Text of a resume shorter than this is treated as missing — a scanned PDF has no text layer
 *
 * @type {number}
 */
const MIN_TEXT_LENGTH = 50;

/**
 * Reads the text layer of a PDF resume
 */
@Injectable()
export class PDFResumeParser implements IResumeParser {
  /**
   * Extensions of the format
   *
   * @var {readonly string[]}
   */
  readonly extensions: readonly string[] = ['.pdf'];

  /**
   * Extract the text of every page as one string
   *
   * @param {Buffer} content
   *
   * @throws {Error} `RESUME_PDF_NO_TEXT` if the PDF has no text layer (a scan)
   *
   * @returns {Promise<string>}
   */
  async parse(content: Buffer): Promise<string> {
    const pdf = await getDocumentProxy(new Uint8Array(content));
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = text.trim();

    if (trimmed.length < MIN_TEXT_LENGTH) {
      throw new Error('RESUME_PDF_NO_TEXT: the PDF has no text layer — scanned resumes are not supported');
    }

    return trimmed;
  }
}
