import * as assert from 'node:assert';
import { array, lazy, number, string, union, type Schema } from '../src';
import { testBothModes } from './helpers';

testBothModes('Lazy schemas', ({ test }) => {
  test('declares without forcing the thunk (direct self-reference as object property)', () => {
    type X = { kind: 'a'; next?: X };
    let x: Schema<X>;
    assert.doesNotThrow(() => {
      x = lazy(() => ({ kind: 'a' as const, 'next?': x })) as any;
    });
  });

  test('validates non-recursive shape', () => {
    type X = { kind: 'a'; next?: X };
    let x: Schema<X>;
    x = lazy(() => ({ kind: 'a' as const, 'next?': x })) as any;

    const [result, errors] = x!.fix({ kind: 'a' });
    assert.strictEqual(errors.length, 0);
    assert.deepStrictEqual(result, { kind: 'a' });
    assert.strictEqual(x!.is({ kind: 'a' }), true);
  });

  test('validates arbitrarily deep recursive input', () => {
    type X = { kind: 'a'; next?: X };
    let x: Schema<X>;
    x = lazy(() => ({ kind: 'a' as const, 'next?': x })) as any;

    const deep: X = { kind: 'a', next: { kind: 'a', next: { kind: 'a', next: { kind: 'a' } } } };
    const [result, errors] = x!.fix(deep);
    assert.strictEqual(errors.length, 0);
    assert.deepStrictEqual(result, deep);
    assert.strictEqual(x!.is(deep), true);
  });

  test('reports errors with the correct path through recursion', () => {
    type X = { kind: 'a'; next?: X };
    let x: Schema<X>;
    x = lazy(() => ({ kind: 'a' as const, 'next?': x })) as any;

    const [, errors] = x!.fix({ kind: 'a', next: { kind: 'b' as any, next: { kind: 'a' } } });
    const msgs = errors.map(e => e.toString()).join('\n');
    assert.ok(/\$\.next\.kind:/.test(msgs), `expected error at $.next.kind, got:\n${msgs}`);
  });

  test('does not stack-overflow when a non-object lands in a recursive slot', () => {
    type X = { kind: 'a'; next?: X };
    let x: Schema<X>;
    x = lazy(() => ({ kind: 'a' as const, 'next?': x })) as any;

    let result: any, errors: any;
    assert.doesNotThrow(() => {
      [result, errors] = x!.fix({ kind: 'a', next: 'oops' as any });
    });
    assert.strictEqual(x!.is(result), true);
    const msgs = errors.map((e: any) => e.toString()).join('\n');
    assert.ok(
      msgs.includes('$.next: Expected object but got string'),
      `expected '$.next: Expected object but got string', got:\n${msgs}`
    );
  });

  test('handles cyclic input without infinite recursion', () => {
    type Y = { name: string; self?: Y };
    let y: Schema<Y>;
    y = lazy(() => ({ name: string, 'self?': y })) as any;

    const cyclic: any = { name: 'a' };
    cyclic.self = cyclic;

    let errors: any;
    assert.doesNotThrow(() => {
      [, errors] = y!.fix(cyclic);
    });
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(y!.is(cyclic), true);
  });

  test('handles mutually cyclic input', () => {
    type Y = { name: string; self?: Y };
    let y: Schema<Y>;
    y = lazy(() => ({ name: string, 'self?': y })) as any;

    const a: any = { name: 'a' };
    const b: any = { name: 'b' };
    a.self = b;
    b.self = a;

    assert.doesNotThrow(() => y!.fix(a));
    assert.strictEqual(y!.is(a), true);
  });

  test('mutual recursion between two lazy schemas', () => {
    let a: Schema<any>, b: Schema<any>;
    a = lazy(() => ({ name: string, 'b?': b }));
    b = lazy(() => ({ name: string, 'a?': a }));

    const [result, errors] = a.fix({ name: 'a1', b: { name: 'b1', a: { name: 'a2' } } });
    assert.strictEqual(errors.length, 0);
    assert.deepStrictEqual(result, { name: 'a1', b: { name: 'b1', a: { name: 'a2' } } });
  });

  test('recursion through an array (the README tree pattern)', () => {
    type Tree = { value: number; children: Tree[] };
    let tree: Schema<Tree>;
    tree = lazy(() => ({ value: number, children: array(tree) })) as any;

    const valid: Tree = { value: 1, children: [{ value: 2, children: [{ value: 3, children: [] }] }] };
    const [result, errors] = tree.fix(valid);
    assert.strictEqual(errors.length, 0);
    assert.deepStrictEqual(result, valid);

    const [bad, badErrors] = tree.fix({ value: 1, children: [{ value: 'x' as any, children: [] }] });
    assert.strictEqual(tree.is(bad), true);
    const msgs = badErrors.map(e => e.toString()).join('\n');
    assert.ok(msgs.includes('$.children[0].value: Expected number but got string'),
      `got:\n${msgs}`);
  });

  test('recursion through a discriminated union', () => {
    type Node = { kind: 'leaf'; value: number } | { kind: 'branch'; left: Node; right: Node };
    let node: Schema<Node>;
    node = lazy(() =>
      union(
        { kind: 'leaf' as const, value: number },
        { kind: 'branch' as const, left: node, right: node }
      )
    ) as any;

    const valid: Node = {
      kind: 'branch',
      left: { kind: 'branch', left: { kind: 'leaf', value: 1 }, right: { kind: 'leaf', value: 2 } },
      right: { kind: 'leaf', value: 3 },
    };
    const [result, errors] = node.fix(valid);
    assert.strictEqual(errors.length, 0);
    assert.deepStrictEqual(result, valid);
  });

  test('.fallback of a recursive lazy schema is finite and valid', () => {
    let s: Schema<any>;
    s = lazy(() => ({ x: string, 'y?': s }));

    let fb: any;
    assert.doesNotThrow(() => { fb = (s as any).fallback; });
    assert.deepStrictEqual(fb, { x: '' });
    assert.strictEqual(s.is(fb), true);
  });

  test('unrealizable schema (required self-recursion) does not crash', () => {
    let z: Schema<any>;
    z = lazy(() => ({ kind: 'a', next: z }));

    let result: any, errors: any;
    assert.doesNotThrow(() => { [result, errors] = z.fix({ kind: 'a' }); });
    assert.ok(errors.length > 0);
    const msgs = errors.map((e: any) => e.toString()).join('\n');
    assert.ok(msgs.includes('Missing key "next"'), `got:\n${msgs}`);

    let fb: any;
    assert.doesNotThrow(() => { fb = (z as any).fallback; });
    assert.strictEqual(fb.kind, 'a');
    assert.strictEqual(fb.next, undefined);
  });

  test('lazy over a primitive still works and does not pollute the cycle-detection set', () => {
    const s: Schema<string> = lazy(() => string);
    assert.deepStrictEqual(s.fix('hello'), ['hello', []]);
    assert.deepStrictEqual(s.fix('hello'), ['hello', []]); // same primitive twice
    const [r, errs] = s.fix(5 as any);
    assert.strictEqual(r, '');
    assert.strictEqual(errs.length, 1);
    assert.strictEqual(errs[0].toString(), '$: Expected string but got number');
  });
});
