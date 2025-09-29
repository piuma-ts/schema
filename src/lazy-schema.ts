import { Schema, TYPE, Path, ErrorHandler, ABORT, RuntimeType } from './common';

export class LazySchema<T> extends Schema<T> {
  get score() {
    return this.definition.score;
  }

  get fallback() {
    return this.definition.fallback as T;
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

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T | ABORT {
    return this.definition.check(dryRun, value, type, path, pos, onError) as T;
  }
}
