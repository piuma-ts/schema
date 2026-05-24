import { TYPE, Path, ErrorHandler, ABORT, Schema, mismatch, RuntimeType } from './common';

export class NeverSchema extends Schema<never> {
  static readonly INST = new NeverSchema();
  readonly fallback = undefined as never;
  readonly [TYPE] = 'never';
  readonly score = -1;

  check(dryRun: boolean, value: unknown, _: RuntimeType, path: Path, pos: number, onError: ErrorHandler): never | ABORT {
    if (value === undefined) return undefined as never;
    if (onError === ABORT) return ABORT;
    onError(path, pos, mismatch('no value', value));
    return undefined as never;
  }
}
