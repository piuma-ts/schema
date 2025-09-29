export function run(name: string, ops: number, fn: (ops: number) => void) {
  fn(ops);
  const start = performance.now();
  fn(ops);
  const time = performance.now() - start;
  console.log(`${name}: ${(ops / (time / 1000)).toFixed(0)} ops/sec (${time.toFixed(2)}ms)`);
}
