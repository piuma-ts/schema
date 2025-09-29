import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType, runtimeType } from './common';

export class ArraySchema<T> extends Schema<T[]> {
  get fallback(): T[] {
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

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T[] | ABORT {
    if (type !== 'array') {
      if (onError === ABORT) return ABORT;
      onError(path, pos, mismatch('array', value));
      return [];
    }

    const length = (value as T[]).length;
    const { item } = this;

    for (let i = 0; i < length; i++) {
      if (onError !== ABORT) path[pos] = i;
      const found = (value as T[])[i];
      const valid = item.check(dryRun, found, runtimeType(found), path, pos + 1, onError);

      if (valid === ABORT) return ABORT;
      if (!dryRun && valid !== found) (value as T[])[i] = valid;
    }
    return value as T[];
  }
}
