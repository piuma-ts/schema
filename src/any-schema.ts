import { ErrorHandler, Path, RuntimeType, Schema, TYPE } from './common';

export class AnySchema<T = any> extends Schema<T> {
  readonly fallback = undefined as T;
  readonly [TYPE] = 'any';
  readonly score = 100000;

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T {
    return value as T;
  }
}
