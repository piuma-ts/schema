# Piuma Schema Validation

A fast and lightweight validation library that can heal invalid data.

# Motivation

TypeScript has an expressive type system and, aside from a few small type holes, gives quite strong guarantees about the correctness of your data flow - assuming that the data actually is what the types say. For this assumption to be guaranteed, we must validate all incoming data at the application boundaries.

This library aims to make such validation cheap, aiming for a sweet spot between JS size and runtime performance - in both throughput and initialization.

The down side of strict validation however is that you get into an all-or-nothing situation: if data doesn't completely match your expectations, then it is just as bad as if there were major differences. Applications that don't validate their data may often get away with showing "undefined" or simply nothing in some part of the UI (unless of course the data is so misaligned with the code that it causes exceptions), which isn't ideal, but still leaves all other parts of the UI in a working state.

We want the best of both worlds: a way to strictly check the data, report any errors, but at the same time allow the application to continue functioning to at least some degree.

# Quick Intro

Install as one might expect:

```bash
npm install @piuma/schema
```

Syntactically, @piuma/schema aims to be as close to TypeScript syntax as possible (without bending over backwards). Here is a simple introductory example:

```typescript
import { string, number, define, array } from '@piuma/schema';

const Post = define({
  title: string,
  content: string,
  'tags?': array(string),
  comments: array({
    user: string,
    contents: string,
    likes: number,
  }),
});

type Post = typeof Post.fallback; // get the corresponding TypeScript type

const data: any = { title: 'Lorem Ipsum', content: 'Dolor sit amet' };

console.log(Post.is(data)); // false
console.log(Post.fix(data)); // [{ title: "Lorem Ipsum", content: "Dolor sit amet", comments: [] }, ["$: Missing key comments"]]
```

Here you can also see a unique feature of @piuma/schema in action: The ability to _fix_ invalid data, while reporting errors.

## Automatic Data Fixing

In the above example, we see the `fix` function being used to get a pair of both valid data _and_ errors found in the original data.

It's important to understand when and how to use such functionality: Suppose some 3rd party API you depend on suddenly starts omitting one field in a giant payload, that is otherwise still useful. In some cases you may wish to treat this as if that API were down - an annoying but realistic scenario. More often than not however, you would prefer for a more graceful degradation, e.g. if you're loading video information from the YouTube API and at some point the response no longer includes a `dislikeCount`, you don't want all features that rely on the entirety of the data to simply stop working.

Whenever you choose to use `fix`, it is _vital_ to feed validation errors into some monitoring / alerting system, otherwise the degradation - while graceful - will be silent. You should also consider letting the user of your application know that the data is incomplete, if this can be achieved without disrupting UX.

# Comparison

For reference, we'll be comparing this library to:

- Zod (4.1.11): no doubt the most popular option
- Valibot (1.1.0): among the smallest out there (if you make good use of its treeshakeability)
- ArkType (2.1.22): among the fastest out there (although this really quite depends on what you measure and how)

The primary reason for creating yet another validation library was that nothing on npm seems to offer automatic data fixing, in particular none of the libraries above.

Other concerns were size (download time) and performance (blocking time) - we'll have a detailed look at how @piuma/schema fares here compared to some pretty tough competition from both Valibot and ArkType. The sources of the benchmarks can be found at https://github.com/piuma-ts/schema/tree/master/benchmarks

## JIT

There are two ways that a schema can be used to validate a value:

1. "interpreted": the data passed to the schema is used to inspect the value that is being validated, using reflection (Zod, Valibot)
2. "compiled": the data passed to the schema is used to build an optimized JavaScript function (with `new Function()`) to do the validation.

The first approach is slower to run, the second slower to initialize. To get the best of both worlds, @piuma/schema combines both approaches, using interpreted mode by default and jitting any schemas that are run "a lot". Just how much "a lot" is is governed by `config.jit.threshold`. If you need to disable the JIT entirely (e.g. you're targeting Hermes or another runtime/environment where dynamic code generation is impractical), you can do so via `config.jit.threshold = Infinity`.

This makes @piuma/schema somewhat larger than would be optimal, at least for the time being.

## Size Comparison

In this comparison we are using esbuild to minify the JavaScript. Different bundlers will yield somewhat different results, but the numbers should roughly be the same.

### Library Bundle Size

First, let's compare these libraries in terms of the size they will add to your JavaScript, simply by using them:

| Library       |      Size |
| :------------ | --------: |
| Valibot       |    6.9 kb |
| @piuma/schema |   11.8 kb |
| Zod           |   55.8 kb |
| ArkType       |  146.0 kb |

The Valibot and Zod numbers are based on including roughly the same functionality as @piuma/schema.

### Schema Size

Another factor to be taken into account is how big the schema declarations will be in the end.

| Library         | Benchmark Schema | Unit Test Schema | Geometric Mean |
| :-------------- | ---------------: | ---------------: | -------------: |
| @piuma/schema   |          0.62 kb |          0.76 kb |        0.69 kb |
| ArkType         |          0.63 kb |          0.85 kb |        0.73 kb |
| Zod (optimal)   |          0.65 kb |          0.93 kb |        0.77 kb |
| Valibot         |          0.71 kb |          0.93 kb |        0.81 kb |
| Zod (idiomatic) |          0.79 kb |          1.28 kb |        1.01 kb |

We are using two schemas here, one from our speed benchmarks (see below) and one from our tests, which is slightly larger, even if structurally simpler. Zod has two entries, which are the following:

- idiomatic: used as suggested in the docs: `import { z } from zod; z.object()`
- optimal: used in a way that generates more compact code `import { object } from zod; object()`

This comparison warrants more data points, but the difference we can tentatively observe, roughly reflects the comparative terseness of @piuma/schema definitions as seen already at the source level. Here is an attempt to explain the numbers above:

- ArkType relies on its own string based DSL to define types, which while terse potentially embeds a considerable amount of unminifiable strings in the output
- Valibot (and optimal Zod) requires more function calls, e.g. `string()` vs. just `string` in @piuma/schema and does so even when nesting, e.g. `array(object({}))` vs. `array({})`
- Zod idiomatically uses method calls (e.g. `z.object()`) and even chaining, which are not minifiable (unless you bring out heavy tools like Google Closure)

## Speed Comparison

It's impossible to overstate the importance of taking this type of benchmark with a grain of salt. You will find benchmarks that show [ArkType to be 100x faster than Zod](https://arktype.io/docs/blog/2.0#faster-everything) and you will find benchmarks showing [Zod being 100x faster than ArkType](https://www.reddit.com/r/node/comments/1k7jcb8/false_claim_by_arktype_that_it_is_100x_faster/).

We try to stay clear of the issues found quite commonly across benchmarks, by relying on real world schemas (taken from an undisclosed production application). Also, we will compare on NodeJS, Chrome, Bun and Firefox, showing that the differences we measure will vary considerably at times, with some quite surprising differences between NodeJS and Chrome, which both use the same JavaScript engine.

Numbers given are ops/sec (so higher is better), where the sample data is ~1KB of JSON. The benchmarks were run on an Intel Core Ultra 7 165H, which itself leads to a characteristic performance profile that may well diverge from what you would find on other hardware architectures.

### Schema Creation Speed

If you intend to do schema validation on the client side, then the speed at which schemas are created will impact your main thread blocking time.

| Library       | Node 24.8.0 | Chrome 140.0 | Bun 1.2.22 | Firefox 143 | Geometric Mean |
| :------------ | ----------: | -----------: | ---------: | ----------: | -------------: |
| Valibot       |        83 K |        112 K |      389 K |       333 K |          186 K |
| @piuma/schema |        31 K |         86 K |       73 K |        94 K |           66 K |
| Zod           |         3 K |          6 K |       12 K |        10 K |            7 K |
| ArkType       |         1 K |          2 K |        2 K |         2 K |            2 K |

If we imagine 20 schemas being processed on initial load, on a low power mobile device that is 10x slower than a high end desktop CPU, that means 100ms blocking time with ArkType, vs. ~3ms with @piuma/schema or even just ~1ms with Valibot.

It should be added that this benchmark is actually slightly skewed in favor of Valibot:

1. The Valibot schema definition we are using explicitly employs `variant` to create a discriminated union that requires explicitly passing a key to determine the discriminant property, so as to give optimal validation performance.
2. The @piuma/schema definition just uses the generic `union`, which us then has to build a decision tree to discover the discriminant property. This is more in line with how discriminated unions are defined in TypeScript. Moreover it ensures better performance without requiring the developer to intervene.

### Validation Speed

You'll see 3 numbers for @piuma/schema here:

- `no-opt`: the non-jitted version (measured by disabling the JIT)
- `jitted`: the jitted version
- `quick`: a third mode, that simply determines whether a value matches a schema, without error reporting

The use cases for the quick mode are somewhat limited (it's rarely good enough to just know that the data is invalid, without further context), but you may find various applications for it. In particular if client and server share the same type definitions, a quick check for validatity is still helpful to prevent attackers from sending garbled data to provoke exceptions.

With that in mind, let's check the numbers.

Checking valid data:

| Library                | Node 24.8.0 | Chrome 140.0 | Bun 1.2.22 | Firefox 143 | Geometric Mean |
| :--------------------- | ----------: | -----------: | ---------: | ----------: | -------------: |
| @piuma/schema (quick)  |      6595 K |       7407 K |     5091 K |      2845 K |         5209 K |
| @piuma/schema (jitted) |      5094 K |       6540 K |     4687 K |      2587 K |         4524 K |
| ArkType                |      6739 K |       1476 K |     7186 K |      4684 K |         4271 K |
| @piuma/schema (no-opt) |       640 K |        749 K |      824 K |       422 K |          638 K |
| Zod                    |       178 K |        208 K |      190 K |       133 K |          176 K |
| Valibot                |        93 K |        103 K |      112 K |        90 K |           99 K |

So @piuma/schema (jitted), like ArkType, is roughly 25x faster than Zod, which in turn is almost 2x faster than Valibot.

Checking invalid data:

| Library                | Node 24.8.0 | Chrome 140.0 | Bun 1.2.22 | Firefox 143 | Geometric Mean |
| :--------------------- | ----------: | -----------: | ---------: | ----------: | -------------: |
| @piuma/schema (quick)  |      6502 K |       8372 K |     5537 K |      3125 K |         5632 K |
| @piuma/schema (jitted) |      3828 K |       4586 K |     3785 K |      2155 K |         3506 K |
| @piuma/schema (no-opt) |       600 K |        738 K |      840 K |       403 K |          617 K |
| ArkType                |       114 K |        130 K |      163 K |       161 K |          141 K |
| Valibot                |        81 K |         87 K |       95 K |        80 K |           85 K |
| Zod                    |        30 K |         33 K |       48 K |        34 K |           36 K |

The "quick" mode in `@piuma/schema` stands out, because it is actually faster on invalid than valid data, since it can stop checking as soon as it encounters the first issue (the erroneous value has been put towards the end of the data to be validated, to avoid this speed up from being blown out of proportion). Everywhere else we see slowdowns:

- ArkType: ~30x
- Zod: ~5x
- @piuma/schema (jitted): ~1.3x
- Valibot: ~1.15x

In fact ArkType appears to generally perform poorly with invalid data, and as a result benchmarks can be constructed where ArkType is 100x _slower_ than Zod, rather than 30x times faster (as [the one mentioned above](https://www.reddit.com/r/node/comments/1k7jcb8/false_claim_by_arktype_that_it_is_100x_faster/)).

It is worth pointing out that significant slowdowns, like the one in ArkType and to a lesser degree the one in Zod, present a potential attack vector, where an attacker can use invalid data to adversely affect the performance characteristics of an application in a significant way.

# Non-Goals

In contrast to most other validation libraries (like the ones used for comparison), @piuma/schema has a considerably narrower scope, determined by its stated motivation, which is why some relatively common features are purposefully not included (not now and probably not ever). Let's examine the reasons.

## Transformation

The main goal is to validate data at the application edges (e.g. HTTP requests, file contents, database query results). As such, _transformation_ is not a goal. Massaging data in plain TypeScript is sometimes more tedious, but usually faster and more flexible, and fully safe if you start with validated data.

## Integrated Branding / Tagging

This library explicitly doesn't bring its own solution for branded types. One may yet hope that TypeScript will at some point get first-class support for this, but until such time there will be a multitude of approaches which are not mutually compatible. You should use whatever fits your application the best. Here's a simplistic example using `type-fest`:

```typescript
import { Tagged } from 'type-fest';
import { string } from '@piuma/schema';

type Email = Tagged<string, 'email'>;

const Email = string.refine({
  name: 'email',
  test: (value): value is Email => typeof value === 'string' && value.includes('@'),
  fallback: 'me@example.com' as Email,
  error: value => `${value} is not a valid email address`,
});
```

## Non-JSON-able types

Currently, types that cannot be properly round-tripped through JSON are not supported. The thinking here is that once data has entered your system boundary, it should be safe to send between different parts of it (e.g. your server and your client).

For example, if you have a `Date`, then going through JSON will turn that into a string. You should instead create your own branded "date string" type with `string.refine` or "timestamp" with `number.refine`.

## Integrated formats

Emails? Credit cards? Phone numbers? There's a wide variety of packages on npm for each of those. It is for you to choose which risks you want to take on your signup / checkout form ;)

As demonstrated above, you can use `string.refine` to create a validator of your liking.

It's perhaps worth noting that _any_ schema has a `refine` method, so you can do:

```typescript
const LatLng = define({ lat: number, lng: number }).refine({ name: "latlng", ... /* validate coordinate bounds and precision */});
const Percentages = define([number]).refine({ name: "percentages", ... /* make sure these add up to 100 */})
```

## Async validation

Many validation libraries support async validation, for example to check if an ID that was received is indeed in the database. While convenient, this is not really sound. Because such validation depends on an external source, no guarantees can actually be given if it succeeded. If, for example, said ID is deleted from the database at a later time, but the lifetime of the validated object has not yet expired, you have a live object that asserts the existence of a non-existent ID.

The primary goal of this library is to make sure that the data you obtain from external sources indeed has the static type you expect it to have. How it relates to other data in other external sources is out of its scope and very much your responsibility.

# Reasons to use @piuma/schema

We can conclude that @piuma/schema is for you if:

1. You want graceful degradation through automatic data fixing
2. You need a library tailored specifically for ensuring at runtime that a value complies to a specific structure (and nothing more)
3. You want a validation library that is small _and_ fast, and is fast both during initialization _and_ in terms of throughput