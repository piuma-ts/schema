import { build } from 'esbuild';

export async function getSize(name: string, contents: string, external = new Array<string>()) {
  const result = await build({
    stdin: {
      contents: contents,
      sourcefile: `${name}.ts`,
      resolveDir: 'src',
      loader: 'ts',
    },
    external,
    platform: 'browser',
    format: 'esm',
    charset: 'utf8',
    write: false,
    minify: true,
    treeShaking: true,
    bundle: true,
  });

  return `${name}: ${(result.outputFiles[0].contents.length / 1024).toFixed(2)}kb`;
}
