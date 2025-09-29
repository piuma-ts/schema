import { Schema, TYPE, Path, ABORT, ErrorHandler, RuntimeType, runtimeType, unexpected, print } from './common';

class ConstantSchema<T> extends Schema<T> {
  readonly [TYPE]: string;
  readonly score = 0;

  constructor(readonly fallback: T) {
    super();
    this[TYPE] = runtimeType(this.fallback);
  }

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T | ABORT {
    if (value !== this.fallback) {
      if (onError === ABORT) return ABORT;
      onError(path, pos, unexpected(print(this.fallback), print(value)));
    }
    return this.fallback;
  }
}
const cache = new Map<any, ConstantSchema<any>>();

export const literal = function <const T extends null | boolean | number | string>(fallback: T): ConstantSchema<T> {
  let ret = cache.get(fallback);
  if (!ret) cache.set(fallback, (ret = new ConstantSchema(fallback)));
  return ret;
};
