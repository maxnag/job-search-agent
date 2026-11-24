/**
 * A positional argument of a command
 */
export interface ICLIArgument {
  /**
   * Name shown in the usage line
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * What the argument is
   *
   * @var {string}
   */
  readonly description: string;

  /**
   * The command cannot run without it
   *
   * @var {boolean}
   */
  readonly required?: boolean;
}

/**
 * An option of a command: a flag, or an option with a value when `value` is set
 */
export interface ICLIOption {
  /**
   * Long name without the dashes
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * One-letter name without the dash
   *
   * @var {string}
   */
  readonly short?: string;

  /**
   * Placeholder of the value — an option without it is a flag
   *
   * @var {string}
   */
  readonly value?: string;

  /**
   * What the option does
   *
   * @var {string}
   */
  readonly description: string;

  /**
   * The option may be given several times, every value is kept
   *
   * @var {boolean}
   */
  readonly multiple?: boolean;

  /**
   * The command cannot run without it
   *
   * @var {boolean}
   */
  readonly required?: boolean;

  /**
   * The only values allowed
   *
   * @var {readonly string[]}
   */
  readonly choices?: readonly string[];

  /**
   * The value is a whole number greater than zero
   *
   * @var {boolean}
   */
  readonly integer?: boolean;
}

/**
 * A ready-to-copy call of a command
 */
export interface ICLIExample {
  /**
   * Arguments after the command name
   *
   * @var {string}
   */
  readonly args: string;

  /**
   * What the call does
   *
   * @var {string}
   */
  readonly description: string;
}

/**
 * Everything a command takes: both its parser and its help are built from it
 */
export interface ICLISpec {
  /**
   * Name of the pnpm script
   *
   * @var {string}
   */
  readonly command: string;

  /**
   * What the command does
   *
   * @var {string}
   */
  readonly summary: string;

  /**
   * Positional arguments, in order
   *
   * @var {readonly ICLIArgument[]}
   */
  readonly arguments?: readonly ICLIArgument[];

  /**
   * Options
   *
   * @var {readonly ICLIOption[]}
   */
  readonly options?: readonly ICLIOption[];

  /**
   * Examples
   *
   * @var {readonly ICLIExample[]}
   */
  readonly examples?: readonly ICLIExample[];

  /**
   * Remarks printed at the end of the help
   *
   * @var {readonly string[]}
   */
  readonly notes?: readonly string[];
}
