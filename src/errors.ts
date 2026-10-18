export class MintError extends Error {
  readonly exitCode: number;
  readonly hint: string | undefined;

  constructor(message: string, options: { exitCode: number; hint?: string; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'MintError';
    this.exitCode = options.exitCode;
    this.hint = options.hint;
  }
}

/** Bad invocation: unknown flag, bad value, missing argument. Exits with code 2. */
export class UsageError extends MintError {
  constructor(message: string, hint?: string) {
    super(message, { exitCode: 2, hint });
    this.name = 'UsageError';
  }
}

/** The command was well-formed but could not complete (e.g. clipboard failed). Exits with code 1. */
export class RuntimeError extends MintError {
  constructor(message: string, cause?: unknown) {
    super(message, { exitCode: 1, cause });
    this.name = 'RuntimeError';
  }
}
