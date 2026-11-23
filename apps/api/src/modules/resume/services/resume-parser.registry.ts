import { extname } from 'node:path';

import type { IResumeParser } from '../interfaces/resume-parser.interface.js';

/**
 * Picks the parser of a resume file by its extension
 */
export class ResumeParserRegistry {
  /**
   * Parser of every registered extension
   *
   * @var {ReadonlyMap<string, IResumeParser>}
   */
  private readonly parsers: ReadonlyMap<string, IResumeParser>;

  /**
   * @param {readonly IResumeParser[]} parsers
   *
   * @throws {Error} `RESUME_PARSER_DUPLICATE` if two parsers claim one extension
   */
  constructor(parsers: readonly IResumeParser[]) {
    const byExtension = new Map<string, IResumeParser>();

    for (const parser of parsers) {
      for (const extension of parser.extensions) {
        const owner = byExtension.get(extension);

        if (owner) {
          throw new Error(`RESUME_PARSER_DUPLICATE: ${extension} is read by both ${owner.constructor.name} and ${parser.constructor.name}`);
        }

        byExtension.set(extension, parser);
      }
    }

    this.parsers = byExtension;
  }

  /**
   * Parser of a file
   *
   * @param {string} fileName
   *
   * @throws {Error} `RESUME_FORMAT_UNSUPPORTED` if no parser reads the extension
   *
   * @returns {IResumeParser}
   */
  findOne(fileName: string): IResumeParser {
    const extension = extname(fileName).toLowerCase();
    const parser = this.parsers.get(extension);

    if (!parser) {
      const supported = [...this.parsers.keys()].join(', ');

      throw new Error(`RESUME_FORMAT_UNSUPPORTED: "${extension || fileName}" — supported: ${supported}`);
    }

    return parser;
  }
}
