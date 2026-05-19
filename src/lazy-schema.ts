import { Schema, TYPE, Path, ErrorHandler, ABORT, RuntimeType } from './common';

export class LazySchema<T> extends Schema<T> {
  get score() {
    return 1_000_000;
  }

  protected fallingBack = false;
  get fallback() {
    if (this.fallingBack) return undefined as T;
    this.fallingBack = true;
    try {
      return this.definition.fallback as T;
    } finally {
      this.fallingBack = false;
    }
  }

  get [TYPE]() {
    return this.definition[TYPE];
  }
  protected _definition: Schema<T> | undefined;
  get definition() {
    if (!this._definition) this._definition = this.getDefinition();
    return this._definition;
  }

  constructor(protected getDefinition: () => Schema<T>) {
    super();
  }

  protected checking = new Set();

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T | ABORT {
    if (this.checking.has(value)) return value as T;
    this.checking.add(value);
    try {
      return this.definition.check(dryRun, value, type, path, pos, onError) as T;
    } finally {
      this.checking.delete(value);
    }
  }
}
