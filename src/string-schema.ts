import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType } from './common';

export class StringSchema extends Schema<string> {
  readonly fallback = '';
  readonly [TYPE] = 'string';
  readonly score = 3;

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): string | ABORT {
    if (type !== 'string') {
      if (onError === ABORT) return ABORT;
      onError(path, pos, mismatch('string', value));
      return '';
    }
    return value as string;
  }

  static readonly INST = new StringSchema();
}

export const string = new StringSchema();
