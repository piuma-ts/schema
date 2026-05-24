import { define, SchemaDefinition, SchemaType, any } from '.';
import { ABORT, Check, Schema, Normalize, TYPE, makeChecker, optimizeable, runtimeType } from './common';
import { NeverSchema } from './never-schema';
import { merge, ObjectSchema } from './object-schema';
import { UnionSchema } from './union-schema';
import { select } from './util';

export function intersection<const Definitions extends SchemaDefinition[]>(...definitions: Definitions) {
  type Ret = Normalize<IntersectionOfSchemaTypes<Definitions>>;
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
    const flat: Schema<T>[] = [];
    const objects: ObjectSchema<T>[] = [];
    const types = new Set<string>();

    let hasUnion = false;

    {
      function add(schema: Schema<T>) {
        switch (schema.score) {
          case 10000:
            for (const s of (schema as IntersectionSchema<T>).schemas) add(s);
            break;
          case 100:
            types.add(schema[TYPE]);
            objects.push(schema as ObjectSchema<T>);
            break;
          case 100000:
            break;
          default:
            if (!hasUnion) hasUnion = schema instanceof UnionSchema;
            types.add(schema[TYPE]);
            flat.push(schema);
            break;
        }
      }

      for (const schema of schemas) add(schema);

      if (objects.length > 0) {
        const s = merge(objects);
        if (s.score === -1) return NeverSchema.INST as any;
        flat.push(s);
      }

      switch (flat.length) {
        case 0:
          return any;
        case 1:
          return flat[0];
      }

      if (!hasUnion && types.size > 1) return NeverSchema.INST as any;

      flat.sort((a, b) => a.score - b.score);
    }

    const kind = `(${Array.from(new Set(flat.map(s => s[TYPE]))).join('&')})`;

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

      if (runtimeType(first) === 'object') return intersectObjects(values);

      return first;
  }
}

function intersectObjects<T>(objects: T[]): T {
  const fields = Array.from(new Set(objects.flatMap(o => Object.keys(o as any))));

  return Object.fromEntries(fields.map(f => [f, intersect(select(objects, o => (o as any)[f]))])) as T;
}

export type IntersectionOfSchemaTypes<T extends readonly SchemaDefinition[]> = T extends readonly [infer Head, ...infer Tail]
  ? Head extends SchemaDefinition
    ? Tail extends readonly SchemaDefinition[]
      ? SchemaType<Head> & IntersectionOfSchemaTypes<Tail>
      : SchemaType<Head>
    : unknown
  : unknown;
