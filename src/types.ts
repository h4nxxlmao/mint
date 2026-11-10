import type { Flags } from './flags.js';

export interface GenResult {
  /** The value printed to stdout. */
  value: string;
  /** Extra named fields surfaced by --json (rounds, iv, alphabet, ...). */
  fields?: Record<string, string | number | boolean>;
  /** Bits of CSPRNG entropy in the value. */
  entropyBits?: number;
  /** Raw bytes behind the value, written verbatim by --raw. */
  raw?: Buffer;
}

export interface GenContext {
  command: string;
  flags: Flags;
  positionals: string[];
  /**
   * Reads piped stdin lines. Only the CLI provides this, and only for commands that
   * accept a list; the programmatic API leaves it undefined so a call can never block
   * waiting for input.
   */
  readStdin?: () => string[];
}

export interface Generator {
  name: string;
  /** One-line description for the help screen. */
  summary: string;
  /** Usage line without the program name, e.g. `chars [--charset alnum]`. */
  usage?: string;
  /** Extra paragraphs shown in `mint <cmd> --help`. */
  details?: readonly string[];
  examples?: readonly string[];
  /** Flag names (canonical, without dashes) accepted on top of the global flags. */
  flags?: readonly string[];
  /** Aliases that dispatch to this generator. */
  aliases?: readonly string[];
  /** True when the generator handles --count itself and may return multi-line output. */
  usesCount?: boolean;
  /** True when trailing arguments are meaningful (dice, pick, shuffle, typeid). */
  acceptsPositionals?: boolean;
  run(context: GenContext): GenResult;
}
