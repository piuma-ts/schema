import { type Schema, Simplify, TYPE } from './common';
import { LazySchema } from './lazy-schema';
export { boolean } from './boolean-schema';
export { literal } from './constant-schema';
export { number } from './number-schema';
export { string } from './string-schema';
export { intersection } from './intersection-schema';
export { union, nullable } from './union-schema';

import { ArraySchema } from './array-schema';
import { ObjectProperty, ObjectSchema } from './object-schema';

import { AnySchema } from './any-schema';
import { literal } from './constant-schema';

export { config, type Schema } from './common';

export const unknown = new AnySchema<unknown>();
export const any: AnySchema<any> = unknown;

export function define<const Definition extends SchemaDefinition>(definition: Definition): DefinitionType<Definition> {
  if (typeof definition === 'object') {
    if (definition === null) return literal(null) as any;
    if (TYPE in definition) return definition as any;
    return object(definition) as any;
  } else {
    return literal(definition) as any;
  }
}

export function object<const Definition extends ObjectDefinition>(definition: Definition) {
  return new ObjectSchema<SchemaType<Definition>>(
    Object.entries(definition).map(([key, value]) => {
      const optional = key.endsWith('?');
      if (optional) key = key.slice(0, -1);
      return new ObjectProperty(key, define(value) as any, optional);
    })
  );
}

export function array<const Definition extends SchemaDefinition>(definition: Definition): Schema<ReadonlyArray<SchemaType<Definition>>> {
  return new ArraySchema<SchemaType<Definition>>(define(definition) as any);
}

export function lazy<const Definition extends SchemaDefinition>(d: () => Definition) {
  return new LazySchema<SchemaType<Definition>>(() => define(d()) as any) as Schema<SchemaType<Definition>>;
}

export type SchemaDefinition = Schema<any> | ObjectDefinition | boolean | number | string | null;
export type ObjectDefinition = { [key: string]: SchemaDefinition };

export type SchemaType<T extends SchemaDefinition> = T extends Schema<infer U> ? U : T extends ObjectDefinition ? ObjectDefinitionType<T> : T;

type ObjectDefinitionType<T extends ObjectDefinition> = Simplify<
  { [K in keyof T as K extends `${infer Key}?` ? Key : never]?: SchemaType<T[K]> } & { [K in keyof T as K extends `${infer _}?` ? never : K]: SchemaType<T[K]> }
>;

type DefinitionType<T extends SchemaDefinition> =
  T extends Schema<any>
    ? T
    : T extends [infer U extends SchemaDefinition]
      ? ArraySchema<SchemaType<U>>
      : T extends ObjectDefinition
        ? ObjectSchema<ObjectDefinitionType<T>>
        : Schema<T>;
