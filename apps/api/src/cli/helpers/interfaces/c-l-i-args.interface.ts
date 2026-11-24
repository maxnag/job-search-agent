/**
 * The arguments of a command, checked against its description
 */
export interface ICLIArgs {
  /**
   * Positional arguments, in order
   *
   * @var {readonly string[]}
   */
  readonly positionals: readonly string[];

  /**
   * Values of every option given, by its long name, in order
   *
   * @var {Readonly<Record<string, string[] | undefined>>}
   */
  readonly values: Readonly<Record<string, readonly string[] | undefined>>;

  /**
   * Long names of the flags given
   *
   * @var {ReadonlySet<string>}
   */
  readonly flags: ReadonlySet<string>;
}

/**
 * What reading the command line gave: the arguments, or a text to print and the exit code
 */
export interface ICLIParseResult {
  /**
   * The arguments, when the command may run
   *
   * @var {ICLIArgs}
   */
  readonly args?: ICLIArgs;

  /**
   * The help or the errors, when it may not
   *
   * @var {string}
   */
  readonly output?: string;

  /**
   * Exit code: 0 for the help, 1 for an error
   *
   * @var {number}
   */
  readonly exitCode?: number;
}
