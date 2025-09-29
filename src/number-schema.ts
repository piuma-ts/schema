import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType } from './common';

export class NumberSchema extends Schema<number> {
  readonly fallback = 0;
  readonly [TYPE] = 'number';
  readonly optional = false;

  readonly score = 2;

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): number | ABORT {
    if (type !== 'number') {
      if (onError === ABORT) return ABORT;
      onError(path, pos, mismatch('number', value));
      return 0;
    }
    return value as number;
  }

  static readonly INST = new NumberSchema();
}

export const number = new NumberSchema();
