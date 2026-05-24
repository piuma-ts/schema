import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType, runtimeType } from './common';

export class PrimitiveSchema<T> extends Schema<T> {
  readonly [TYPE]: string;

  constructor(readonly fallback:T, readonly score:number) {
    super();
    this[TYPE] = runtimeType(fallback);
  }

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T | ABORT {
    if (type !== this[TYPE]) {
      if (onError === ABORT) return ABORT;
      onError(path, pos, mismatch(this[TYPE], value));
      return this.fallback;
    }
    return value as T;
  }

}