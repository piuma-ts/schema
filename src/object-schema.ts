import { string, number, boolean, ObjectDefinition, object, SchemaType } from '.';
import { Schema, TYPE, Path, ErrorHandler, ABORT, mismatch, RuntimeType, runtimeType, config, makeChecker, print, Normalize } from './common';
import { IntersectionSchema } from './intersection-schema';
import { NeverSchema } from './never-schema';

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
        } else onError(path, pos, `Missing key ${print(key)}`);
        if (!dryRun) (value as any)[key] = schema.fallback;
      }
    }
    return value as T;
  }

  getCode() {
    if (this.code) return this.code;
    const { key, schema, optional, param } = this;

    const lines: string[] = [];

    const value = `value${fieldAccess(key)}`;

    lines.push(`{`, `const found = ${value};`);

    function fallback() {
      return `if (!dryRun) ${value} = ${param}.fallback;`;
    }

    function check(condition: string, expected: string) {
      // prettier-ignore
      const compare = [
        `if (onError !== ABORT) path[pos] = ${print(key)};`,
        `onError(path, pos + 1, mismatch(${expected}, found));`,
      ];
      // prettier-ignore
      const inspect =
        optional
        ? compare
        : [
          `if (${print(key)} in value) {`,
            ...compare,
          `}`,
          `else onError(path, pos, ${print(`Missing key ${print(key)}`)});`
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
            `if (onError !== ABORT) path[pos] = ${print(key)};`,
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

const validFieldName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export function fieldAccess(name: string) {
  return validFieldName.test(name) ? `.${name}` : `[${print(name)}]`;
}

export type ObjectProperties<T> = readonly ObjectProperty<T>[];

export class ObjectSchema<T> extends Schema<T> {
  static readonly OBJECT = new ObjectSchema<object>([]);
  static optimize = true;

  get fallback(): T {
    let result: T = {} as T;
    for (const { key, schema, optional } of this.properties) if (!optional) result[key] = schema.fallback;
    return result;
  }

  readonly properties: ObjectProperties<T>;
  readonly [TYPE] = 'object';
  readonly score = 100;// TODO: might make sense to derive this from the properties

  constructor(properties: ObjectProperties<T>) {
    super();

    this.properties = properties.toSorted((a, b) => a.score - b.score);
  }

  getProperties(): ObjectProperties<T> {
    return this.properties.slice();
  }

  extend<R extends ObjectSchema<any> | ObjectDefinition>(fields: R) {
    const other = fields instanceof ObjectSchema ? fields : object(fields);
    type Normalized = Normalize<T & (R extends ObjectSchema<infer U> ? U : SchemaType<R>)>;
    type Ret = Normalized extends never ? NeverSchema : ObjectSchema<Normalized>;
    return merge<Ret>([other as any, this as any]) as Ret;
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

export function merge<T>(schemas: ObjectSchema<T>[]) {
  switch (schemas.length) {
    case 0:
      return ObjectSchema.OBJECT as any as ObjectSchema<T>;
    case 1:
      return schemas[0];
    default:
      const byKey = new Map<string, ObjectProperty<T>[]>();

      for (const s of schemas) 
        for (const p of s.properties) {
          const existing = byKey.get(p.key);
          if (existing) existing.push(p);
          else byKey.set(p.key, [p]);
        }

      const properties: ObjectProperty<T>[] = [];

      for (const group of byKey.values()) 
        switch (group.length) {
          case 1:
            properties.push(group[0]);
            break;
          default:
            const schema = IntersectionSchema.of(group.map(p => p.schema));
            const optional = group.every(p => p.optional);
            switch (schema.score) {
              case -1:
                if (!optional) return NeverSchema.INST;
              default:
                properties.push(new ObjectProperty(group[0].key, schema, optional));
                break;
            }
        }

      return new ObjectSchema<T>(properties);
  }
}