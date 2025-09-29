import { string, number, boolean, ObjectDefinition, object, SchemaType } from '.';
import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType, runtimeType, config, makeChecker, print } from './common';

let propertyIdCounter = 0;
export class ObjectProperty<T> {
  readonly score: number;
  readonly param: string;
  constructor(
    readonly key: string & keyof T,
    readonly schema: Schema<T[string & keyof T]>,
    readonly optional: boolean
  ) {
    this.score = schema.score + (optional ? 100 : 0);
    this.param = `p_${propertyIdCounter++}`;
  }

  protected code: string | undefined;

  check(dryRun: boolean, value: unknown, path: Path, pos: number, onError: ErrorHandler): T | ABORT {
    const { key, schema } = this;
    const found = (value as any)[key];
    if (found !== undefined) {
      if (onError !== ABORT) path[pos] = key;
      const valid = schema.check(dryRun, found, runtimeType(found), path, pos + 1, onError);
      if (valid === ABORT) return ABORT;
      if (!dryRun && valid !== found) (value as any)[key] = valid;
    } else {
      if (!this.optional) {
        if (onError === ABORT) return ABORT;
        if (key in (value as any)) {
          path[pos] = key;
          onError(path, pos + 1, mismatch(schema[TYPE], found));
        } else onError(path, pos, `Missing key ${key}`);
        if (!dryRun) (value as any)[key] = schema.fallback;
      }
    }
    return value as T;
  }

  getCode() {
    if (this.code) return this.code;
    const { key, schema, optional, param } = this;

    const lines: string[] = [];

    lines.push(`{`, `const found = value[${print(key)}];`);

    function fallback() {
      return `if (!dryRun) value[${print(key)}] = ${param}.fallback;`;
    }

    function check(condition: string, expected: string) {
      // prettier-ignore
      const compare = [
        `if (onError !== ABORT) path[pos] = "${key}";`,
        `onError(path, pos + 1, mismatch(${expected}, found));`,
      ];
      // prettier-ignore
      const inspect =
        optional
        ? compare
        : [
          `if ("${key}" in value) {`,
            ...compare,
          `}`,
          `else onError(path, pos, "Missing key ${key}");`
        ];
      // prettier-ignore
      lines.push(
        condition === "else" ? "else {" : `if (${condition}) {`,
          `if (onError === ABORT) return ABORT;`,
          ...inspect,
          fallback(),
        `}`,
      );
    }
    switch (
      schema as Schema<unknown> // why though?
    ) {
      // TODO: these fast paths seem to do surprisingly little
      case string:
      case number:
      case boolean:
        const expected = `"${schema[TYPE]}"`;
        check(`${optional ? 'found !== undefined &&' : ''} typeof found !== ${expected}`, expected);
        break;
      default:
        if (schema.score === 0) {
          const value = print(schema.fallback);
          check(`found !== ${value}`, value);
          break;
        }

        // prettier-ignore
        lines.push(
          `if (found !== undefined) {`, 
            `if (onError !== ABORT) path[pos] = "${key}";`,
            `const valid = ${param}.check(dryRun, found, runtimeType(found), path, pos + 1, onError);`,
            `if (valid === ABORT) return ABORT;`,
            `if (!dryRun && valid !== found) value[${print(key)}] = valid;`,
          `}`,
        );

        if (!optional) check('else', `"${schema[TYPE]}"`);
    }
    lines.push(`}`);

    return (this.code = lines.join('\n'));
  }
}

export type ObjectProperties<T> = ObjectProperty<T>[];

export class ObjectSchema<T> extends Schema<T> {
  static optimize = true;

  get fallback(): T {
    let result: T = {} as T;
    for (const { key, schema } of this.properties) result[key] = schema.fallback;
    return result;
  }

  readonly [TYPE] = 'object';
  readonly score = 100;

  constructor(protected properties: ObjectProperties<T>) {
    super();

    properties.sort((a, b) => a.score - b.score);
  }

  getProperties(): ObjectProperties<T> {
    return this.properties.slice();
  }

  extend<R extends ObjectSchema<any> | ObjectDefinition>(fields: R): ObjectSchema<T & (R extends ObjectSchema<infer U> ? U : SchemaType<R>)> {
    const other: ObjectSchema<any> = fields instanceof ObjectSchema ? fields : object(fields);
    return new ObjectSchema<any>(other.properties.concat(this.properties));
  }

  protected optimize() {
    const lines: string[] = [];
    const properties = this.properties;

    lines.push(`if (type !== "object") { if (onError === ABORT) return ABORT; onError(path, pos, mismatch("object", value)); return getDefault(); }`);

    for (const p of properties) lines.push(p.getCode());

    lines.push(`return value;`);

    this.check = makeChecker(
      properties.map(p => [p.param, p.schema] as const),
      () => this.fallback,
      lines
    );
  }

  protected runs = 0;
  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T | ABORT {
    if (type !== 'object') {
      if (onError === ABORT) return ABORT;
      onError(path, pos, mismatch('object', value));
      return this.fallback;
    }

    if (this.runs++ > config.jit.threshold) {
      this.optimize();
      return this.check(dryRun, value, type, path, pos, onError);
    }

    for (const p of this.properties) if (p.check(dryRun, value, path, pos, onError) === ABORT) return ABORT;

    return value as T;
  }
}
