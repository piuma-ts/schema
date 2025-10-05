import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType, runtimeType } from './common';

export class ArraySchema<T> extends Schema<ReadonlyArray<T>> {
  get fallback(): ReadonlyArray<T> {
    return [];
  }
  readonly [TYPE] = 'array';
  readonly score = 1000;

  toString(): string {
    return `[${this.item.toString()}]`;
  }

  constructor(readonly item: Schema<T>) {
    super();
  }

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): ReadonlyArray<T> | ABORT {
    if (type !== 'array') {
      if (onError === ABORT) return ABORT;
      onError(path, pos, mismatch('array', value));
      return [];
    }

    const typed = value as T[];
    const { length } = typed;
    const { item } = this;

    for (let i = 0; i < length; i++) {
      if (onError !== ABORT) path[pos] = i;
      const found = typed[i];
      const valid = item.check(dryRun, found, runtimeType(found), path, pos + 1, onError);

      if (valid === ABORT) return ABORT;
      if (!dryRun && valid !== found) typed[i] = valid;
    }
    return typed;
  }
}
