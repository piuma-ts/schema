import { boolean, define, number, SchemaDefinition, SchemaType } from '.';
import { ArraySchema } from './array-schema';
import { ABORT, Check, ErrorHandler, makeChecker, optimizeable, Path, print, RuntimeType, Schema, Simplify, TYPE } from './common';

import { type IntersectionSchema } from './intersection-schema';
import { LazySchema } from './lazy-schema';
import { NeverSchema } from './never-schema';

import { ObjectProperties, ObjectProperty, ObjectSchema } from './object-schema';
import { string } from './string-schema';

export function nullable<const Definition extends SchemaDefinition>(definition: Definition) {
  return union(null, definition); // TODO: use a specialized schema?
}

export function union<const Definitions extends SchemaDefinition[]>(...definitions: Definitions): Schema<Simplify<UnionOfSchemaTypes<Definitions>>> {
  type Ret = UnionOfSchemaTypes<Definitions>;
  return UnionSchema.of<Ret>(definitions.map<Schema<Ret>>(define as any));
}

export class UnionSchema<T> extends Schema<T> {
  readonly fallback: T;
  readonly [TYPE]: string = 'never';
  readonly score = 20000;

  protected readonly schemas: Schema<T>[] = [];
  protected readonly primitives = new Map<string, boolean>();
  protected readonly arrays: Schema<T>[] = [];
  protected readonly constants = new Map<string, T[]>();
  protected readonly other: Check<T>;
  readonly multiType: boolean = false;

  constructor(schemas: Schema<T>[]) {
    super();

    this.fallback = schemas[0].fallback;

    for (const schema of schemas) {
      if (schema instanceof UnionSchema) {
        for (const s of schema.schemas) this.schemas.push(s);
      } else this.schemas.push(schema);
    }

    const other: Candidates<T> = [];
    const added = new Set<Schema<T>>();
    const kinds = new Set<string>();

    const process = (s: Schema<T>) => {
      if (added.has(s)) return;
      added.add(s);
      kinds.add(s[TYPE]);

      switch (s as Schema<any>) {
        case string:
        case number:
        case boolean:
          this.primitives.set(s[TYPE], true);
          return;
      }
      if (s.score === 0) this.constants.get(s[TYPE])?.push(s.fallback) ?? this.constants.set(s[TYPE], [s.fallback]);
      else if (s instanceof ArraySchema) this.arrays.push(s as Schema<any>);
      else if (s instanceof ObjectSchema) other.push([s, s.getProperties() as ObjectProperties<T>]);
      else if (s instanceof LazySchema) process(s.definition);
      else if (s.score === 10000)
        other.push([s, (s as IntersectionSchema<T>).schemas.flatMap(s => (s instanceof ObjectSchema ? s.getProperties() : [])) as ObjectProperties<T>]);
      else other.push([s, []]);
    };

    for (const s of this.schemas) process(s);

    this[TYPE] = (this.multiType = kinds.size > 1) ? `(${Array.from(kinds).join(' | ')})` : Array.from(kinds)[0];

    if (this.multiType) this.score++;

    this.other = other.length ? decisionTree(other, () => this.fallback) : objectNotAllowed(() => this.fallback);
    if (!this.multiType && other.length) this.check = this.other;
  }

  static of<T>(schemas: Schema<T>[]): Schema<T> {
    switch (schemas.length) {
      case 0:
        return new NeverSchema() as any;
      case 1:
        return schemas[0];
    }
    return new UnionSchema<T>(schemas);
  }

  check(dryRun: boolean, value: unknown, type: RuntimeType, path: Path, pos: number, onError: ErrorHandler): T | ABORT {
    switch (type) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'null':
      case 'undefined':
        if (this.primitives.get(type)) return value as T;
        const constantValues = this.constants.get(type);

        if (constantValues && constantValues.includes(value as T)) return value as T;

        if (onError === ABORT) return ABORT;

        onError(
          path,
          pos,
          `Unexpected ${type}${value == null ? '' : ` ${print(value)}`}${constantValues ? ` (allowed: ${constantValues.map(v => print(v)).join(' | ')})` : ''}`
        );
        return this.fallback;
      case 'array':
        switch (this.arrays.length) {
          case 0:
            if (onError === ABORT) return ABORT;
            onError(path, pos, `Unexpected array`);
            return this.fallback;
          case 1:
            return this.arrays[0].check(dryRun, value, type, path, pos, onError) as T;
          default:
            for (const a of this.arrays) if ((a as Schema<T>).is(value)) return value;
            if (onError === ABORT) return ABORT;
            onError(path, pos, `Array found, but no matching schema`);
            return this.fallback;
        }
      case 'object':
        return this.other(dryRun, value as {}, type, path, pos, onError);
    }
    return value as T;
  }
}

export type UnionOfSchemaTypes<T extends readonly SchemaDefinition[]> = T extends readonly [infer Head, ...infer Tail]
  ? Head extends SchemaDefinition
    ? Tail extends readonly SchemaDefinition[]
      ? SchemaType<Head> | UnionOfSchemaTypes<Tail>
      : SchemaType<Head>
    : never
  : never;

type Candidates<T> = [schema: Schema<T>, properties: ObjectProperties<T>][];

function optimizedDecisionTree<T>(tree: Tree<T>, getFallback: () => T) {
  const lines: string[] = [];
  const schemas: Schema<any>[] = [];

  function addSchema(schema: Schema<any>) {
    if (!schemas.includes(schema)) schemas.push(schema);
    return `schema${schema.id}`;
  }

  function rec(tree: Tree<T>): void {
    const condition = tree[0];
    switch (condition) {
      case true:
      case false:
        if (tree.length === 2 && condition) {
          lines.push(`return ${addSchema(tree[1])}.check(dryRun, value, type, path, pos, onError);`);
        } else {
          const [, ...branches] = tree;
          for (const schema of branches) lines.push(`if (${addSchema(schema)}.check(dryRun, value, type, path, pos, ABORT) !== ABORT) return value;`);
        }
        break;
      default:
        const { key, schema } = condition;

        lines.push(`let found = value.${key}`); // TODO: potentially not a valid identifier

        const condCode =
          schema.score === 0
            ? `found === ${print(schema.fallback)}`
            : `${addSchema(schema)}.check(true, found, runtimeType(found), path, pos, ABORT) !== ABORT`;

        lines.push(`if (${condCode}) {`);
        rec(tree[1]);
        if (tree[2]) {
          lines.push(`} else {`);
          rec(tree[2]);
        }
        lines.push(`}`);
        break;
    }
  }

  rec(tree);

  // prettier-ignore
  lines.push(
    `if (onError === ABORT) return ABORT`,
    `onError(path, pos, "${NO_MATCH}")`,
    `return getDefault()`
  );

  return makeChecker(
    schemas.map(s => [`schema${s.id}`, s]),
    getFallback,
    lines
  );
}

function partition<T>(candidates: Candidates<T>, prop: ObjectProperty<T>) {
  const consequence: typeof candidates = [];
  const alternative: typeof candidates = [];

  const { key, schema: type } = prop;

  for (const [schema, properties] of candidates) {
    const i = properties.findIndex(({ key: k, schema: s }) => k === key && s === type);
    if (i === -1) alternative.push([schema, properties]);
    else consequence.push([schema, properties.slice(0, i).concat(properties.slice(i + 1))]);
  }

  return [consequence, alternative];
}

function discriminant<T>(candidates: Candidates<T>) {
  let min = 10000;

  for (const [, properties] of candidates)
    if (properties[0]) {
      const score = properties[0].score;
      if (score < min) {
        if ((min = score) === 0) break;
      }
    }

  if (min < 100)
    for (const [, properties] of candidates) {
      const prop = properties[0];

      if (prop && prop.score === min) return prop;
    }
}

type Tree<T> =
  | readonly [discriminator: ObjectProperty<T>, consequence: Tree<T>, alternative: Tree<T> | null]
  | readonly [positive: boolean, ...rest: Schema<T>[]];

function makeTree<T>(candidates: Candidates<T>): Tree<T> {
  /**
   * TODO: the way that the tree is built is not really optimal.
   * It doesn't take any benefit from the shapes in the different candidates to balance the tree more properly,
   * i.e. it might wind up building a long if-else chain, instead of a shallower, more balanced tree.
   * It should probably look for constants first too. Typical discriminated unions could be handled in a switch statement.
   */

  type Properties = ObjectProperties<T>;

  function rec(candidates: Candidates<T>, positive: boolean): Tree<T> {
    function propDecision(prop: Properties[number]): Tree<T> {
      const [consequences, alternatives] = partition(candidates, prop);

      if (consequences.length === 0) throw 'assert'; // should never happen, because of how this is called
      if (alternatives.length === 0 && consequences.length > 1) return rec(consequences, positive); // there's no branching actually, so recurse with pruned properties

      return [prop, rec(consequences, true), rec(alternatives, false)];
    }

    if (candidates.length > (positive ? 1 : 0)) {
      const prop = discriminant(candidates);
      if (prop) return propDecision(prop);
    }

    const ret: [boolean, ...rest: Schema<T>[]] = [positive];
    for (const [schema] of candidates) ret.push(schema);
    return ret;
  }

  return rec(candidates, false);
}

function makeCheck<T>(tree: Tree<T>, getFallback: () => T): Check<T> {
  const condition = tree[0];
  switch (condition) {
    case true:
    case false:
      if (tree.length === 2 && condition) {
        const schema = tree[1];
        return schema.check.bind(schema);
      }

      const [, ...branches] = tree;

      return (dryRun, value: any, type, path, pos, onError) => {
        for (let i = 0; i < branches.length; i++) if (branches[i].check(dryRun, value, type, path, pos, ABORT) !== ABORT) return value;
        if (onError === ABORT) return ABORT;
        onError(path, pos, NO_MATCH);
        return getFallback();
      };
    default:
      const { key, schema } = condition;

      const consequence = makeCheck(tree[1], getFallback);
      const alternative = tree[2] ? makeCheck(tree[2], getFallback) : null;

      return (dryRun, value: any, type, path, pos, onError) => {
        const branch = schema.is(value[key]) ? consequence : alternative;
        return branch ? branch(dryRun, value, type, path, pos, onError) : getFallback();
      };
  }
}

function decisionTree<T>(candidates: Candidates<T>, getFallback: () => T): Check<T> {
  const tree = makeTree(candidates);
  return optimizeable(makeCheck(tree, getFallback), () => optimizedDecisionTree(tree, getFallback));
}

function objectNotAllowed<T>(getFallback: () => T): Check<T> {
  return (_dryRun, _value, _type, path, pos, onError) => {
    if (onError === ABORT) return ABORT;
    onError(path, pos, `Object not allowed here`);
    return getFallback();
  };
}

const NO_MATCH = `Object matches none of the possible structures`;
