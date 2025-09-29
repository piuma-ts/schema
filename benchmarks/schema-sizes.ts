import { getSize } from './get-size';

(async () => {
  const externals: Record<string, string> = { piuma: '@piuma/schema' };
  const sizes = new Array<string>();

  for (const benchmark of ['wall', 'user']) {
    sizes.push(`${benchmark}:`);
    for (const name of ['piuma', 'arktype', 'valibot', 'zod-idiomatic', 'zod-compact'])
      sizes.push('  ' + (await getSize(name, `export { schema } from '../benchmarks/${benchmark}/${name}';`, [externals[name] ?? name.split('-')[0]])));
  }

  console.log(sizes.join('\n'));
})();
