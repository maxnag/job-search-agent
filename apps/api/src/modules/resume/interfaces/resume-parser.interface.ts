/**
 * Turns a resume file of one format into plain text; a new format is a new parser registered in the module
 */
export interface IResumeParser {
  /**
   * Lower-cased file extensions the parser reads, with the dot (`.pdf`)
   *
   * @var {readonly string[]}
   */
  readonly extensions: readonly string[];

  /**
   * Extract the text of a resume file
   *
   * @param {Buffer} content
   *
   * @returns {Promise<string>}
   */
  parse(content: Buffer): Promise<string>;
}
