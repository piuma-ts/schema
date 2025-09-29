export type Path = (string | number)[];

export const TYPE = Symbol();
export const ABORT = Symbol();
export type ABORT = typeof ABORT;

export type ErrorHandler = ABORT | ((path: Path, pos: number, error: string) => void);

export type RuntimeType = 'undefined' | 'null' | 'boolean' | 'number' | 'string' | 'object' | 'array' | 'never';

export function runtimeType(value: unknown): RuntimeType {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'undefined':
      return 'undefined';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'object':
      return Array.isArray(value) ? 'array' : 'object';
    default:
      return 'never';
  }
}

type Values = ReadonlyArray<readonly [name: string, value: any]>;

export function withValues<T>(values: (readonly [string, any])[], code: string): T {
  return new Function(...values.map(([name]) => name), code)(...values.map(([, value]) => value));
}

export function makeChecker<T>(
  values: Values,
  getDefault: () => T,
  lines: string[]
): (dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler) => T | ABORT {
  return withValues(
    [['ABORT', ABORT], ['runtimeType', runtimeType], ['mismatch', mismatch], ['getDefault', getDefault], ...values],
    `return (dryRun, value, type, path, pos, onError) => { ${lines.join('\n')} }`
  );
}

export type Check<T> = (dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler) => T | ABORT;

export type Checker<T> = {
  readonly check: Check<T>;
};

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {}; // stolen from type-fest to avoid the dependency for one line

export function optimizeable<T>(c: Check<T>, optimized: () => Check<T>): Check<T> {
  let count = 0;
  let ret = c;

  ret = (dryRun, value, type, path, pos, onError) => {
    if (count++ < config.jit.threshold) return c(dryRun, value, type, path, pos, onError);
    ret = optimized();
    return ret(dryRun, value, type, path, pos, onError);
  };

  return (dryRun, value, type, path, pos, onError) => {
    return ret(dryRun, value, type, path, pos, onError);
  };
}

let idCounter = 0;
export abstract class Schema<T> {
  readonly id = idCounter++;
  abstract readonly fallback: T;
  abstract readonly [TYPE]: string;
  abstract readonly score: number;

  abstract check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T | ABORT;

  fix(value: unknown): [value: T, errors: ValidationError[]] {
    const [errors, onError] = reporter();
    return [withPath(path => this.check(false, value, runtimeType(value), path, 0, onError) as T), errors] as const;
  }

  validate<T>(value: unknown): ValidationError[] {
    const [errors, onError] = reporter();
    withPath(path => this.check(true, value, runtimeType(value), path, 0, onError) as T);
    return errors;
  }

  assert(value: unknown): asserts value is T {
    withPath(path =>
      this.check(true, value, runtimeType(value), path, 0, (path, pos, error) => {
        throw ValidationError.make(error, path, pos);
      })
    );
  }

  is = (value: unknown): value is T => this.check(true, value, runtimeType(value), FAKE, 0, ABORT) !== ABORT;

  refine<T2 extends T>({
    name,
    fallback,
    test,
    error,
  }: {
    name: string;
    fallback: T2;
    test: T extends T2 ? (value: T) => boolean : (value: T) => value is T2;
    error: (value: T) => string;
  }): Schema<T2> {
    return new WhereSchema<T, T2>(name, this, fallback, test as any, error);
  }

  downcast<R extends T>(): Schema<R> {
    return this as any;
  }
}

export const print = JSON.stringify;

export function unexpected(expect: string, found: string) {
  return `Expected ${expect} but got ${found}`;
}

export function mismatch(expect: string, value: unknown) {
  return unexpected(expect, value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
}

class WhereSchema<T, T2 extends T> extends Schema<T2> {
  readonly [TYPE]: string;
  readonly score: number;

  constructor(
    readonly name: string,
    readonly schema: Schema<T>,
    readonly fallback: T2,
    readonly test: (value: T) => value is T2,
    readonly error: (value: T) => string
  ) {
    super();
    this[TYPE] = this.schema[TYPE];
    this.score = this.schema.score + 10;
  }

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T2 | ABORT {
    const result = this.schema.check(dryRun, value, type, path, pos, onError);
    if (result === ABORT) return ABORT;

    if (!this.test(result)) {
      if (onError === ABORT) return ABORT;
      onError(path, pos, this.error(result));
      return this.fallback;
    }

    return result;
  }
}

export const config = { maxErrors: 100, jit: { threshold: 100 } };

export class ValidationError {
  constructor(
    readonly message: string,
    readonly path: Path
  ) {}

  toString() {
    const parts = ['$'];

    for (const part of this.path) parts.push(typeof part === 'number' ? `[${part}]` : `.${part}`);

    parts.push(`: ${this.message}`);
    return parts.join('');
  }

  static make(message: string, path: Path, pos: number) {
    return new ValidationError(message, path.slice(0, pos));
  }
}

function reporter() {
  const maxErrors = config.maxErrors;
  const errors: ValidationError[] = [];
  return [
    errors,
    function (path: Path, pos: number, error: string) {
      if (errors.length < maxErrors) errors.push(ValidationError.make(error, path, pos));
    },
  ] as const;
}

export function validate<T>(schema: Schema<T>, value: unknown): asserts value is T {
  withPath(path =>
    schema.check(true, value, runtimeType(value), path, 0, (path, pos, error) => {
      throw ValidationError.make(error, path, pos);
    })
  );
}

const FAKE: Path = [];

const pool: any[][] = [];

function withPath<T>(f: (path: Path) => T) {
  const path = pool.pop() ?? new Array(100);
  try {
    return f(path);
  } finally {
    pool.push(path);
  }
}
