import { getSize } from './get-size';

(async () => {
  const sizes = await Promise.all([
    getSize('valibot', "export { null, optional, variant, string, number, boolean, array, object, union, intersect, parse, safeParse } from 'valibot';"),
    getSize('piuma', "export * from '../src/index';"),
    getSize('zod', "export { null, optional, discriminatedUnion, string, number, boolean, array, object, union, intersection, parse, safeParse } from 'zod';"),
    getSize('arktype', "export { type } from 'arktype';"),
  ]);
  console.log(sizes.join('\n'));
})();
