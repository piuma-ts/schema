import { define, SchemaDefinition, SchemaType } from '.';
import { AnySchema } from './any-schema';
import { ABORT, Check, Schema, TYPE, makeChecker, optimizeable } from './common';
import { NeverSchema } from './never-schema';
import { type UnionSchema } from './union-schema';

export function intersection<const Definitions extends SchemaDefinition[]>(...definitions: Definitions) {
  type Ret = IntersectionOfSchemaTypes<Definitions>;
  return IntersectionSchema.of<Ret>(definitions.map<Schema<Ret>>(define as any));
}

export class IntersectionSchema<T> extends Schema<T> {
  get fallback() {
    switch (this.schemas.length) {
      case 0:
        return undefined as T;
      case 1:
        return this.schemas[0].fallback;
      default:
        return intersect(this.schemas.map(s => s.fallback));
    }
  }

  get optional() {
    return this.schemas.length === 0;
  }

  readonly score = 10000;
  readonly [TYPE]: string;
  readonly check: Check<T>;

  protected constructor(
    kind: string,
    readonly schemas: Schema<T>[]
  ) {
    super();
    this[TYPE] = kind;
    this.check = optimizeable(
      (dryRun, value, type, path, pos, onError) => {
        for (const schema of this.schemas) if (schema.check(dryRun, value, type, path, pos, onError) === ABORT) return ABORT;
        return value as T;
      },
      () => {
        const lines: string[] = [];

        for (const schema of this.schemas) lines.push(`if (schema${schema.id}.check(dryRun, value, type, path, pos, onError) === ABORT) return ABORT;`);

        lines.push(`return value;`);

        return makeChecker(
          schemas.map(s => [`schema${s.id}`, s] as const),
          () => this.fallback,
          lines
        );
      }
    );
  }

  static of<T>(schemas: Schema<T>[]): Schema<T> {
    if (schemas.length === 0) return new AnySchema() as any;

    const flat: Schema<T>[] = [];

    {
      function add(schema: Schema<T>) {
        if (schema instanceof IntersectionSchema) {
          for (const s of schema.schemas) add(s);
        } else flat.push(schema);
        // TODO: consider union schemas
      }

      for (const schema of schemas) add(schema);

      flat.sort((a, b) => a.score - b.score);
    }

    const first = flat[0];
    const kind = first[TYPE];

    if (!(first.score === 20000 && (first as UnionSchema<T>).multiType)) {
      for (const schema of flat) if (schema[TYPE] !== kind) return new NeverSchema() as any;
    }

    return new IntersectionSchema<T>(kind, flat);
  }
}

function intersect<V>(values: V[]): V {
  switch (values.length) {
    case 0:
      return undefined as V;
    case 1:
      return values[0];
    default:
      const first = values[0];
      switch (typeof first) {
        case 'string':
        case 'number':
        case 'boolean':
          return values.every(v => v === first) ? first : (undefined as V);
        case 'object':
          if (first === null) return null as V;
          if (Array.isArray(first)) return [] as V;
          return Object.assign({}, ...values) as V; // technically this is not correct (should intersect values, rather than successively overriding), but it's good enough for now
        default:
          throw 'cannot intersect ' + typeof first;
      }
  }
}

export type IntersectionOfSchemaTypes<T extends readonly SchemaDefinition[]> = T extends readonly [infer Head, ...infer Tail]
  ? Head extends SchemaDefinition
    ? Tail extends readonly SchemaDefinition[]
      ? SchemaType<Head> & IntersectionOfSchemaTypes<Tail>
      : SchemaType<Head>
    : unknown
  : unknown;
