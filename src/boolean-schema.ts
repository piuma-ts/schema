import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType } from './common';

export class BooleanSchema extends Schema<boolean> {
  readonly fallback = false;
  readonly [TYPE] = 'boolean';

  readonly score = 1;

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): boolean | ABORT {
    if (type !== 'boolean') {
      if (onError === ABORT) return ABORT;
      onError(path, pos, mismatch('boolean', value));
      return false;
    }
    return value as boolean;
  }

  static readonly INST = new BooleanSchema();
}

export const boolean = new BooleanSchema();
